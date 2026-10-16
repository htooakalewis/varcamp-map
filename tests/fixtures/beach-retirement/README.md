# Historic beach robot retirement fixtures

- `before-layout.json`: exact authored source from `d669f9bbe030a6e12dc60a05c613df998b22db10:world/layouts/shipyard-beach.json`; file SHA-256 `5635b749473ea26afa6d692195a9ab78539c0aa875a0cb82f053b25f7bab89a9`.
- `retired-native.tmj`: exact post-retirement native source from `888dd3ce8bf2d6702d339b252c32584fa281ecab:maps/shipyard-beach.tmj`; file SHA-256 `4e179e1cd7e2018bf136e03ee075a2973e27ee236f7b1c2c2ef44ca2e172b601`. Its semantic digest remains the original frozen `c656d02d3e7675dc3cbe54ac20649c1be6c93aec8969be5249c805bc918db11e`.

The real addNpcGuides function is tested against the historical authored input and the independently extracted historical retired result digest. The old native retirement receipt and collision digest remain unchanged. Later beach artwork is checked through a separate refinement receipt and strict native delta constraints. No git access is needed in shallow CI.
