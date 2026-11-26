import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected renderer initialization error.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[HelalRendererError]', error, info.componentStack);
  }

  private handleResetSettings = () => {
    try {
      localStorage.removeItem('helal_video_converter_settings_v1');
    } catch {
      // Ignore storage failures
    }
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0F17] text-slate-100 p-6">
          <div className="max-w-lg w-full rounded-xl border border-slate-800 bg-[#121926] p-6 space-y-4">
            <h1 className="text-lg font-semibold text-slate-50">
              Helal Video Converter failed to render
            </h1>
            <p className="text-xs leading-relaxed text-slate-300 font-mono break-words bg-slate-950 border border-slate-800 rounded-lg p-3">
              {this.state.message}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
              >
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleResetSettings}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors"
              >
                Reset Local Settings & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
