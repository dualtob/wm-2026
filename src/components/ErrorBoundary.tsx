import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="error-screen">
            <div className="error-screen__icon">⚠️</div>
            <h2>Something went wrong</h2>
            <button
              className="btn btn--primary"
              onClick={() => this.setState({ hasError: false })}
            >
              Retry
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
