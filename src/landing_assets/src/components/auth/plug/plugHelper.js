const host = process.env.NODE_ENV === "development" ? "http://localhost:8000" : undefined

const Helper = {
    /**
     * @return {Promise<import("@dfinity/principal").Principal | undefined>};
     */
    getLoggedInPrincipal: async () => {
        try {
            const wallet = getGlobalWallet()
            if (wallet) {
                const connected = await wallet.isConnected()
                if (connected) {
                    return await Helper.getPrincipal()
                }
            }
        } catch (e) {
            console.warn("Cannot auto-login with Plug:", e);
        }
    },
    /**
     * @param {Array<string> | undefined} whitelist
     * @return {Promise<import("@dfinity/principal").Principal | undefined>};
     */
    login: async (whitelist = undefined) => {
        try {
            const wallet = getGlobalWallet()
            if (wallet) {
                const result = await wallet.requestConnect({
                    host: host,
                    whitelist: whitelist,
                    timeout: 10000,
                });
                if (result) {
                    return await Helper.getPrincipal()
                }
            }
        } catch (e) {
            console.warn("Cannot login with Plug:", e);
            throw e
        }
    },

    /**
     * @return {Promise<import("@dfinity/principal").Principal | undefined>};
     */
    getPrincipal: async () => {
        const wallet = getGlobalWallet()
        if (wallet) {
            return await wallet.getPrincipal()
        }
        return undefined
    },

    /**
     * @param {string} canisterId
     * @param {import("@dfinity/candid").IDL.InterfaceFactory} interfaceFactory
     * @return {Promise<import("@dfinity/agent").ActorSubclass<T> | undefined>};
     */
    createActor: async (canisterId, interfaceFactory) => {
        const parameters = {
            canisterId: canisterId,
            interfaceFactory: interfaceFactory
        }
        try {
            const wallet = getGlobalWallet()
            if (wallet) {
                console.log("PlugHelper: createActor", parameters);
                return await wallet.createActor(parameters)
            }
        } catch (e) {
            console.error("Plug: cannot create actor using parameters", parameters, e);
        }
        return undefined
    },

    /**
     * Disconnect
     */
    logout: async () => {
        try {
            const wallet = getGlobalWallet()
            if (wallet) {
                console.log("Plug: logout");
                await wallet.disconnect()
            }
        } catch (e) {
            console.error("Plug: cannot disconnect");
        }
    },
};

export const PlugHelper = Helper

const getGlobalIC = () => {
    // @ts-ignore
    return window.ic
}

const getGlobalWallet = () => {
    // @ts-ignore
    return getGlobalIC().plug
}