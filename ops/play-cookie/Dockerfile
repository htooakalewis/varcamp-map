FROM thecodingmachine/workadventure-play@sha256:e063ea840b75a26cb740c642ad79fb27c5facfff53fe4e5ba40eb3f50d3f72c0
LABEL org.opencontainers.image.revision="oidc-cookie-e90a8ff4392c69d9b20ee0648e112c94da2f7393e1048e4cc5db97cda05cf753" \
      io.varcamp.baseline.source="96d43a841766b22418c061744e7ed2aafd9870d3" \
      io.varcamp.cookie.patch.sha256="e90a8ff4392c69d9b20ee0648e112c94da2f7393e1048e4cc5db97cda05cf753"
COPY --chown=node:node --chmod=0644 src/pusher/services/OpenIDClient.ts /usr/src/play/src/pusher/services/OpenIDClient.ts
COPY --chown=node:node --chmod=0644 src/pusher/controllers/AuthenticateController.ts /usr/src/play/src/pusher/controllers/AuthenticateController.ts
COPY --chown=node:node --chmod=0644 src/pusher/services/TransientOidcCookieOptions.ts /usr/src/play/src/pusher/services/TransientOidcCookieOptions.ts
