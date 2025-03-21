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
      // You can render any custom fallback UI
      return (
        <div className="p-6 rounded-lg bg-red-50 border border-red-200">
          <h2 className="text-xl font-semibold text-red-700 mb-4">Something went wrong.</h2>
          {this.props.fallback || (
            <div className="text-gray-700">
              <details className="mb-4">
                <summary className="cursor-pointer font-medium text-red-600 hover:text-red-800">Error Details</summary>
                <div className="mt-2 p-4 bg-gray-100 rounded overflow-auto">
                  <p className="font-mono text-sm">{this.state.error && this.state.error.toString()}</p>
                  <p className="font-medium mt-2">Component Stack:</p>
                  <p className="font-mono text-sm whitespace-pre-wrap">
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </p>
                </div>
              </details>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      );
    }

    // If there's no error, render children normally
    return this.props.children;
  }
}
