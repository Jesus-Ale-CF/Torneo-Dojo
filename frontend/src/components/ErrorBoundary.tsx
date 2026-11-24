import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, Home, RefreshCw } from 'lucide-react';

type Props = {
  children: ReactNode;
  /** Dónde está el límite ("aplicación", "página"…); se registra en consola con el error. */
  scope: string;
  /** Cuando cambia (p. ej. la ruta), el límite se rearma solo. */
  resetKey?: string;
  /** true = ocupa toda la pantalla (límite raíz); false = solo el área de contenido. */
  fullScreen?: boolean;
};
type State = { error: Error | null };

/**
 * Evita la pantalla en blanco cuando un componente lanza durante el render.
 * Usa enlaces/recarga nativos (no depende del router ni de contextos que puedan haber fallado).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const component = info.componentStack?.split('\n').map((l) => l.trim()).find(Boolean) ?? 'desconocido';
    console.error(`[ErrorBoundary:${this.props.scope}] ruta=${window.location.pathname} componente=${component}`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className={this.props.fullScreen ? 'flex min-h-dvh items-center justify-center bg-bg px-4 text-ink' : 'flex items-center justify-center px-4 py-12'}>
        <div role="alert" className="card flex w-full max-w-md flex-col items-center gap-3 border-shu/40 px-6 py-10 text-center">
          <div className="rounded-full bg-shu/10 p-3 text-shu"><AlertOctagon className="h-6 w-6" aria-hidden /></div>
          <h2 className="text-lg">Algo salió mal</h2>
          <p className="max-w-sm text-sm text-muted">Ocurrió un error inesperado al mostrar esta pantalla. Puedes reintentar o volver al inicio.</p>
          {import.meta.env.DEV && (
            <pre className="max-h-48 w-full overflow-auto rounded-lg bg-elevated p-3 text-left text-xs text-ink" data-testid="error-detail">{error.message}{'\n'}{error.stack?.split('\n').slice(1, 6).join('\n')}</pre>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => this.setState({ error: null })}><RefreshCw className="h-4 w-4" aria-hidden />Reintentar</button>
            <a href="/" className="btn-primary"><Home className="h-4 w-4" aria-hidden />Volver al inicio</a>
          </div>
        </div>
      </div>
    );
  }
}
