# Canistergeek UI

Canistergeek UI is a sample frontend application that utilizes [canistergeek-js](https://github.com/ORIGYN-SA/canistergeek-js).

> canistergeek-js should be used together with [Canistergeek-Motoko](https://github.com/ORIGYN-SA/canistergeek-ic-motoko) - open-source library for Internet Computer to track your project canisters cycles and memory status.

## Running the project locally

If you want to test your project locally, you can start a development server with:

```bash
# Install all dependencies
npm install
# Build
npm run build
# Start local server on port 3001
npm run start
# If you get webpack-cli error run the following then do the npm run start
npm install --save-dev webpack-cli
```

Which will start a server at `http://localhost:3001`, proxying API requests to the replica at port 8000.

