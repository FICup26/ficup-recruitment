import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Errore imprevisto di rendering.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FANTA ITALIA CUP ErrorBoundary:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (typeof window !== 'undefined') {
      window.location.hash = '';
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#C69214]">
                  FANTA ITALIA CUP · L&apos;universo del Fantacalcio
                </p>
                <h1 className="font-display text-lg font-bold text-[#0B1F4D]">
                  Si è verificato un errore applicativo
                </h1>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Un componente dell&apos;interfaccia ha riscontrato un problema imprevisto. Nessun dato è stato alterato.
            </p>
            {this.state.errorMessage && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono-tabular text-slate-700 break-words mb-6">
                {this.state.errorMessage}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1F4D] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#153985] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Ricarica il portale</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
