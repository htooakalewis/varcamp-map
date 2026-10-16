"""Strict image identity checks and bounded local artifact evidence acquisition."""
import hashlib
import json
import os
import pathlib
import re
import stat

BASE_SOURCE = "96d43a841766b22418c061744e7ed2aafd9870d3"
BASE_IMAGE = "thecodingmachine/workadventure-play@sha256:e063ea840b75a26cb740c642ad79fb27c5facfff53fe4e5ba40eb3f50d3f72c0"
SOURCE_ORIGINALS = {
    "src/pusher/services/OpenIDClient.ts": "eb7cc1c6085b5a89449ecffb276df4c8e1298a22520e6ca77b6b6380ea3869ea",
    "src/pusher/controllers/AuthenticateController.ts": "174ef7cf372536a6989e7de8d5f483894a640716093e273cc98d2479ff878062",
    "src/pusher/services/TransientOidcCookieOptions.ts": None,
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def byte_hash(value):
    return isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value) is not None and value != "0" * 64


def image_id(value):
    return isinstance(value, str) and re.fullmatch(r"sha256:[a-f0-9]{64}", value) is not None


def artifact_parts(value):
    require(isinstance(value, str), "Missing artifact path")
    parts = value.split("/")
    require(len(parts) >= 2 and parts[0] == "artifacts" and all(part not in ("", ".", "..") for part in parts), "Unsafe artifact path")
    require("\\" not in value and "\x00" not in value, "Unsafe artifact path")
    return parts


def validate_image_locks(entries):
    locks = {}
    for entry in entries:
        require(isinstance(entry, dict), "Invalid image lock")
        reference = entry.get("image")
        require(isinstance(reference, str) and reference not in locks, "Missing/duplicate image reference")
        require(entry.get("platform") == "linux/arm64", "Locked architecture mismatch")
        mode = entry.get("identityMode", "registry-digest-v1")
        if mode == "registry-digest-v1":
            require(re.fullmatch(r"[^\s@]+@sha256:[a-f0-9]{64}", reference) is not None, "Registry digest reference required")
        elif mode == "local-artifact-v1":
            require(re.fullmatch(r"varcamp/workadventure-play:oidc-cookie-[a-z0-9-]+", reference) is not None, "Invalid local Play reference")
            require(image_id(entry.get("imageId")), "Invalid locked image ID")
            require(entry["imageId"] != BASE_IMAGE.split("@")[1], "Stock image cannot be relabeled as derived")
            archive = entry.get("archive", {})
            provenance = entry.get("provenance", {})
            artifact_parts(archive.get("file"))
            artifact_parts(provenance.get("receiptFile"))
            require(byte_hash(archive.get("sha256")) and byte_hash(provenance.get("receiptSha256")) and byte_hash(provenance.get("patchSha256")), "Invalid artifact hash")
            require(provenance.get("baselineSourceCommit") == BASE_SOURCE and provenance.get("baseImage") == BASE_IMAGE, "Unreviewed baseline source/base")
            require("indexDigest" not in entry, "Local output cannot claim a registry index")
        else:
            raise ValueError("Unknown image identity mode")
        locks[reference] = entry
    return locks


def validate_service_image_locks(services, locks):
    for service, config in services.items():
        reference = config.get("image")
        require(reference in locks, "Service image is not locked")
        require(config.get("platform") == "linux/arm64", "Service platform mismatch")
        if locks[reference].get("identityMode") == "local-artifact-v1":
            require(service == "play" and config.get("pull_policy") == "never", "Local mode is restricted to Play with pull_policy never")


def validate_local_evidence(lock, evidence):
    require(isinstance(evidence, dict), "Missing local artifact evidence")
    archive = lock["archive"]
    provenance = lock["provenance"]
    require(evidence.get("archiveSha256") == archive["sha256"] and evidence.get("receiptSha256") == provenance["receiptSha256"], "Artifact bytes mismatch")
    receipt = evidence.get("receipt")
    require(isinstance(receipt, dict), "Missing provenance receipt")
    require(receipt.get("schema") == "local-artifact-v1", "Invalid receipt schema")
    for field in ("image", "imageId", "platform", "archive"):
        require(receipt.get(field) == lock[field], "Receipt identity/archive mismatch")
    for field in ("baselineSourceCommit", "baseImage", "patchSha256"):
        require(receipt.get(field) == provenance[field], "Receipt baseline/patch mismatch")
    require(receipt.get("baseImageId") == BASE_IMAGE.split("@")[1] and receipt["imageId"] != receipt["baseImageId"], "Derived/base image mismatch")
    require(type(receipt.get("patchBytes")) is int and receipt["patchBytes"] > 0, "Empty reviewed patch")
    files = receipt.get("sourceFiles", {})
    require(set(files) == set(SOURCE_ORIGINALS), "Missing/unexpected installed source receipts")
    for path, original in SOURCE_ORIGINALS.items():
        record = files[path]
        require(record.get("originalSha256") == original, "Original source mismatch")
        require(byte_hash(record.get("patchedSha256")) and record.get("installedSha256") == record["patchedSha256"] and record["patchedSha256"] != original, "Installed source mismatch")
        require(record.get("uid") == 1000 and record.get("gid") == 1000 and record.get("mode") == "0644", "Installed source ownership/permissions mismatch")
    build = receipt.get("build", {})
    require(byte_hash(build.get("dockerfileSha256")) and byte_hash(build.get("contextSha256")), "Missing build input hashes")
    inputs = build.get("contextFiles", {})
    require(set(inputs) == set(SOURCE_ORIGINALS) | {"Dockerfile", "cookie.patch", "source-files.json"} and all(byte_hash(value) for value in inputs.values()), "Missing/unexpected build context inputs")
    require(inputs["Dockerfile"] == build["dockerfileSha256"] and inputs["cookie.patch"] == provenance["patchSha256"], "Build input correspondence mismatch")
    require(all(inputs[path] == files[path]["patchedSha256"] for path in files), "Build/source mismatch")
    expected_toolchain = {"node": "v24.21.0", "tsx": "4.22.3", "express": "5.2.1", "cookie": "0.7.2", "openid-client": "5.7.1", "typescript": "5.9.3"}
    require(all(build.get("toolchain", {}).get(key) == value for key, value in expected_toolchain.items()), "Pinned toolchain mismatch")
    transfer = receipt.get("exportImport", {})
    require(transfer.get("beforeImageId") == lock["imageId"] and transfer.get("afterImageId") == lock["imageId"] and transfer.get("archiveSha256") == archive["sha256"], "Export/import identity mismatch")
    fixture = receipt.get("composeFixture", {})
    require(fixture.get("image") == lock["image"] and fixture.get("configImage") == lock["image"] and fixture.get("imageId") == lock["imageId"] and fixture.get("pullPolicy") == "never", "Compose fixture identity mismatch")


def read_artifact(project_root, relative, *, receipt=False):
    # Open each component without following symlinks; hash the same open file.
    parts = artifact_parts(relative)
    directory = os.open(project_root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    descriptor = None
    try:
        for part in parts[:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            os.close(directory)
            directory = child
        descriptor = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        metadata = os.fstat(descriptor)
        require(stat.S_ISREG(metadata.st_mode) and metadata.st_size > 0, "Artifact must be a nonempty regular file")
        require(not receipt or metadata.st_size <= 1024 * 1024, "Receipt exceeds bounded size")
        digest = hashlib.sha256()
        content = bytearray()
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            if receipt:
                content.extend(chunk)
                require(len(content) <= 1024 * 1024, "Receipt exceeds bounded size")
        after = os.fstat(descriptor)
        require((metadata.st_size, metadata.st_mtime_ns, metadata.st_ctime_ns) == (after.st_size, after.st_mtime_ns, after.st_ctime_ns), "Artifact changed while hashing")
        return digest.hexdigest(), bytes(content)
    finally:
        if descriptor is not None:
            os.close(descriptor)
        os.close(directory)


def acquire_local_evidence(project_root, lock):
    validate_image_locks([lock])
    require(lock.get("identityMode") == "local-artifact-v1", "Local artifact lock required")
    archive_hash, _ = read_artifact(project_root, lock["archive"]["file"])
    receipt_hash, content = read_artifact(project_root, lock["provenance"]["receiptFile"], receipt=True)
    require(archive_hash == lock["archive"]["sha256"] and receipt_hash == lock["provenance"]["receiptSha256"], "Artifact checksum mismatch")
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "Duplicate receipt field")
            result[key] = value
        return result
    evidence = {"archiveSha256": archive_hash, "receiptSha256": receipt_hash, "receipt": json.loads(content, object_pairs_hook=unique_object)}
    validate_local_evidence(lock, evidence)
    return evidence


def check_reserved_ports(sockets):
    reserved_tcp = {7880, 7881, 3479, 5349, 50051, 50053, 9000}
    reserved_udp = {7882, 3478}
    for line in sockets.splitlines():
        fields = line.split()
        protocol = fields[0]
        port = int(fields[4].rsplit(':', 1)[1])
        if protocol == 'tcp' and port in reserved_tcp:
            raise ValueError(f'Reserved TCP port {port} is occupied')
        if protocol == 'udp' and (
            port in reserved_udp or 40000 <= port <= 40999 or 55000 <= port <= 55999
        ):
            raise ValueError(f'Reserved UDP port {port} is occupied')


def check_running_services(services, containers, images, *, image_locks=None, local_evidence=None):
    if image_locks is not None:
        image_locks = validate_image_locks(image_locks.values())
        validate_service_image_locks(services, image_locks)
    seen = set()
    for container in containers:
        labels = container['Config']['Labels']
        service = labels.get('com.docker.compose.service')
        if labels.get('com.docker.compose.project') != 'varcamp' or service not in services:
            raise ValueError('Unexpected project/service label')
        if service in seen:
            raise ValueError(f'Duplicate running service: {service}')
        seen.add(service)
        state = container['State']
        if not state['Running'] or state.get('Health', {}).get('Status', 'healthy') != 'healthy':
            raise ValueError(f'Service is not running and healthy: {service}')

        reference = services[service]['image']
        expected = images[reference]
        actual = images[container['Image']]
        if container['Config']['Image'] != reference:
            raise ValueError(f'Running reference mismatch: {service}')
        if container['Image'] != expected['Id'] or actual['Id'] != expected['Id']:
            raise ValueError(f'Running image ID mismatch: {service}')
        local_lock = (image_locks or {}).get(reference, {})
        local = local_lock.get('identityMode') == 'local-artifact-v1'
        if local:
            if expected['Id'] != local_lock['imageId'] or container['Image'] != local_lock['imageId'] or actual['Id'] != local_lock['imageId']:
                raise ValueError(f'Locked local image ID mismatch: {service}')
            validate_local_evidence(local_lock, (local_evidence or {}).get(reference))
        for record in (expected, actual):
            if record['Os'] != 'linux' or record['Architecture'] != 'arm64':
                raise ValueError(f'Running image architecture mismatch: {service}')
            if not local and reference not in record.get('RepoDigests', []):
                raise ValueError(f'Running image digest mismatch: {service}')
    if seen != set(services):
        raise ValueError('Missing expected running service')
