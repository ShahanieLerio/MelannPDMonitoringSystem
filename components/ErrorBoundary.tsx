
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    // Explicitly initialize state
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('System Module Crash:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[400px] flex items-center justify-center p-8 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-red-100 max-w-md w-full text-center space-y-6 animate-slideUp">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto text-4xl">⚠️</div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-tight">Module Encountered<br />An Error</h2>
                            <p className="text-slate-500 mt-2 font-medium text-sm">The requested feature failed to initialize properly. This may be due to missing data or a connection timeout.</p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Technical Stack Trace:</p>
                            <p className="text-[11px] font-mono text-red-500 break-all leading-relaxed bg-white p-2 rounded-lg border border-red-50">
                                {this.state.error?.message || 'Unknown system fault'}
                            </p>
                        </div>

                        <div className="pt-2 space-y-3">
                            <button
                                onClick={this.handleReload}
                                className="w-full py-4 bg-[#064e3b] text-white font-black rounded-2xl hover:bg-black transition-all shadow-lg shadow-emerald-900/10 active:scale-95 uppercase tracking-widest text-[10px]"
                            >
                                Refresh System View
                            </button>
                            <button
                                onClick={this.handleReset}
                                className="w-full py-4 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95 uppercase tracking-widest text-[10px]"
                            >
                                Try To Recover
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
