
import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    isChunkError: boolean;
}

class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
        isChunkError: false,
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        const isChunkError =
            error?.message?.includes("Failed to fetch dynamically imported module") ||
            error?.name === "ChunkLoadError" ||
            error?.message?.includes("Importing a module script failed") ||
            error?.message?.includes("error loading dynamically imported module");

        return { hasError: true, error, errorInfo: null, isChunkError };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });

        const isChunkError =
            error?.message?.includes("Failed to fetch dynamically imported module") ||
            error?.name === "ChunkLoadError" ||
            error?.message?.includes("Importing a module script failed") ||
            error?.message?.includes("error loading dynamically imported module");

        if (isChunkError) {
            const pageHasBeenReloaded = sessionStorage.getItem("page_reloaded_for_chunk_error");
            if (!pageHasBeenReloaded) {
                sessionStorage.setItem("page_reloaded_for_chunk_error", "true");
                window.location.reload();
            }
        }
    }

    private handleReload = () => {
        sessionStorage.removeItem("page_reloaded_for_chunk_error");
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.state.isChunkError) {
                return (
                    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
                        <div className="max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-2xl">
                            <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto">
                                <RefreshCw className="w-6 h-6 animate-spin" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold font-heading">App Updated</h2>
                                <p className="text-sm text-zinc-400">
                                    A new version of the app has been published. Please refresh to load the latest version.
                                </p>
                            </div>
                            <button
                                onClick={this.handleReload}
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all"
                            >
                                Refresh Now
                            </button>
                        </div>
                    </div>
                );
            }

            return (
                <div className="p-8 bg-red-50 text-red-900 h-screen overflow-auto">
                    <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
                    <p className="mb-4">Please report this error to the developer:</p>
                    <pre className="bg-red-100 p-4 rounded text-sm font-mono whitespace-pre-wrap">
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;

