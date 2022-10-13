import * as React from "react";
import {PropsWithChildren, Reducer, useCallback, useEffect, useReducer} from "react";
import {unstable_batchedUpdates} from "react-dom";
import {useCustomCompareCallback, useCustomCompareMemo} from "use-custom-compare";
import _ from "lodash";
import {useAuthSourceProviderContext} from "../authSource/AuthSourceProvider";
import {PlugHelper} from "./plugHelper";
import {Identity} from "@dfinity/agent";
import {AuthAccount} from "../AuthCommon";
import {Util} from "../util";
import {CreateActorFn, CreateActorOptions} from "../AuthProvider";
import {IDL} from "@dfinity/candid";
import {Principal} from "@dfinity/principal";

type ContextStatus = {
    inProgress: boolean
    isReady: boolean
    isLoggedIn: boolean
}

type ContextState = {
    identity: Identity | undefined
    principal: Principal | undefined
    accounts: Array<AuthAccount>
}

type LoginFn = () => Promise<boolean>
type LogoutFn = () => void

interface Context {
    status: ContextStatus
    state: ContextState
    login: LoginFn
    logout: LogoutFn
    createActor: CreateActorFn
}

const initialContextValue: Context = {
    status: {
        inProgress: false,
        isReady: false,
        isLoggedIn: false,
    },
    state: {
        identity: undefined,
        principal: undefined,
        accounts: [],
    },
    login: () => Promise.reject(),
    logout: () => undefined,
    createActor: () => Promise.resolve(undefined),
}

const PlugAuthProviderContext = React.createContext<Context | undefined>(undefined)
export const usePlugAuthProviderContext = () => {
    const context = React.useContext<Context | undefined>(PlugAuthProviderContext);
    if (!context) {
        throw new Error("usePlugAuthProviderContext must be used within a PlugAuthProviderContext.Provider")
    }
    return context;
};

type Props = {
    whitelist?: Array<string>
}

export const PlugAuthProvider = (props: PropsWithChildren<Props>) => {
    const authSourceProviderContext = useAuthSourceProviderContext();

    // STATE

    const [contextStatus, updateContextStatus] = useReducer<Reducer<ContextStatus, Partial<ContextStatus>>>(
        (state, newState) => ({...state, ...newState}),
        _.cloneDeep(initialContextValue.status)
    )

    const [contextState, updateContextState] = useReducer<Reducer<ContextState, Partial<ContextState>>>(
        (state, newState) => ({...state, ...newState}),
        _.cloneDeep(initialContextValue.state)
    )

    const login: LoginFn = useCustomCompareCallback<LoginFn, [Array<string> | undefined]>(async () => {
        try {
            unstable_batchedUpdates(() => {
                authSourceProviderContext.setSource("Plug")
                updateContextStatus({inProgress: true})
            })
            if (process.env.NODE_ENV === "development") {
                console.log("Plug.login: will call 'await PlugHelper.login' with whitelist", props.whitelist);
            }
            const principal = await PlugHelper.login(props.whitelist)
            if (process.env.NODE_ENV === "development") {
                console.log("Plug.login: got principal", principal, principal?.toText());
            }
            if (principal) {
                const accounts = await getPrincipalAccounts(principal)
                unstable_batchedUpdates(() => {
                    updateContextStatus({isLoggedIn: true, inProgress: false})
                    updateContextState({principal: principal, accounts: accounts})
                })
                return true
            }
            unstable_batchedUpdates(() => {
                authSourceProviderContext.setSource(undefined)
                updateContextStatus({isLoggedIn: false, inProgress: false})
                updateContextState({principal: undefined, accounts: []})
            })
        } catch (e) {
            console.error("PlugAuthProvider: login: caught error", e);
            unstable_batchedUpdates(() => {
                authSourceProviderContext.setSource(undefined)
                updateContextStatus({isLoggedIn: false, inProgress: false})
                updateContextState({principal: undefined, accounts: []})
            })
        }
        return false
    }, [props.whitelist], (prevDeps, nextDeps) => {
        return _.isEqual(prevDeps, nextDeps)
    })

    const logout: LogoutFn = useCallback<LogoutFn>(async () => {
        unstable_batchedUpdates(() => {
            PlugHelper.logout()
            authSourceProviderContext.setSource(undefined)
            updateContextStatus({isLoggedIn: false})
            updateContextState({principal: undefined, accounts: []})
        })
    }, [])

    const createActor: CreateActorFn = useCustomCompareCallback(async function <T>(canisterId: string, idlFactory: IDL.InterfaceFactory, options?: CreateActorOptions) {
        if (process.env.NODE_ENV === "development") {
            console.log("PlugAuthProvider: start with", {canisterId, idlFactory, options});
        }
        const createActorResult = await PlugHelper.createActor(canisterId, idlFactory);
        if (process.env.NODE_ENV === "development") {
            console.log("PlugAuthProvider: createActorResult", createActorResult);
        }
        if (createActorResult != undefined) {
            return createActorResult
        }
    }, [], _.isEqual)

    // EFFECT
    useEffect(() => {
        (async () => {
            try {
                if (authSourceProviderContext.source == "Plug") {
                    updateContextStatus({inProgress: true})
                    if (process.env.NODE_ENV === "development") {
                        console.log("Plug.autologin: will call 'await PlugHelper.getLoggedInIdentity'");
                    }
                    const principal = await PlugHelper.getLoggedInPrincipal()
                    if (process.env.NODE_ENV === "development") {
                        console.log("Plug.autologin: got principal", principal, principal?.toText());
                    }
                    if (principal) {
                        const accounts = await getPrincipalAccounts(principal)
                        unstable_batchedUpdates(() => {
                            updateContextStatus({isReady: true, isLoggedIn: true, inProgress: false})
                            updateContextState({principal: principal, accounts: accounts})
                        })
                        return
                    }
                }
                unstable_batchedUpdates(() => {
                    if (authSourceProviderContext.source == "Plug") {
                        authSourceProviderContext.setSource(undefined)
                    }
                    updateContextStatus({isReady: true, isLoggedIn: false, inProgress: false})
                    updateContextState({principal: undefined, accounts: []})
                })
            } catch (e) {
                console.error("PlugAuthProvider: useEffect[]: caught error", authSourceProviderContext.source, e);
                unstable_batchedUpdates(() => {
                    if (authSourceProviderContext.source == "Plug") {
                        authSourceProviderContext.setSource(undefined)
                    }
                    updateContextStatus({isReady: true, isLoggedIn: false, inProgress: false})
                    updateContextState({principal: undefined, accounts: []})
                })
            }
        })()
    }, [])

    // RESULT

    const value = useCustomCompareMemo<Context, [
        ContextStatus,
        ContextState,
        LoginFn,
        LogoutFn,
        CreateActorFn,
    ]>(() => ({
        status: contextStatus,
        state: contextState,
        login: login,
        logout: logout,
        createActor: createActor,
    }), [
        contextStatus,
        contextState,
        login,
        logout,
        createActor
    ], (prevDeps, nextDeps) => {
        return _.isEqual(prevDeps, nextDeps)
    })

    return <PlugAuthProviderContext.Provider value={value}>
        {props.children}
    </PlugAuthProviderContext.Provider>
}

const getPrincipalAccounts = async (principal: Principal): Promise<Array<AuthAccount>> => {
    try {
        return [{
            name: "Plug",
            accountIdentifier: Util.principalToAccountIdentifier(principal.toText(), 0)
        }]
    } catch (e) {
        return []
    }
}