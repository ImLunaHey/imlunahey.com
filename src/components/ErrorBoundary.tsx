import { Component, ErrorInfo, ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { fallback?: ReactNode; children: ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }
> {
  constructor(props: { fallback?: ReactNode; children: ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can log the error to an error reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-[#1a1a1a] border border-red-900 overflow-auto">
          {this.props.fallback ?? (
            <div>
              <h2 className="text-xl font-semibold text-red-400 mb-4">Something went wrong.</h2>
              <div className="text-gray-300">
                <details className="mb-4">
                  <summary className="cursor-pointer font-medium text-red-400 hover:text-red-300">Error Details</summary>
                  <div className="mt-2 p-4 bg-[#262626] rounded overflow-auto">
                    <p className="font-mono text-sm">{this.state.error && this.state.error.toString()}</p>
                    <p className="font-medium mt-2">Component Stack:</p>
                    <p className="font-mono text-sm whitespace-pre-wrap">
                      {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </p>
                  </div>
                </details>
                <button
                  onClick={() => this.setState({ hasError: false })}
                  className="px-4 py-2 bg-red-900 text-white rounded hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-opacity-50 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // If there's no error, render children normally
    return this.props.children;
  }
}
