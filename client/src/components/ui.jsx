import { useLanguage } from '../context/useLanguage.js';

export const Button = ({ variant = 'primary', className = '', children, ...props }) => (
  <button className={`btn btn-${variant} ${className}`.trim()} {...props}>{children}</button>
);

export const Card = ({ className = '', children, ...props }) => (
  <section className={`surface-card ${className}`.trim()} {...props}>{children}</section>
);

export const PageHeader = ({ eyebrow, title, description, actions }) => (
  <header className="page-heading">
    <div>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="page-heading-actions">{actions}</div>}
  </header>
);

export const Badge = ({ children, tone = 'green' }) => (
  <span className={`status-badge status-badge-${tone}`}>{children}</span>
);

export const FormField = ({ id, label, optional = false, type = 'text', inputMode, ...props }) => {
  const { t } = useLanguage();
  const effectiveInputMode = inputMode || (type === 'number' ? 'decimal' : undefined);
  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>
        {label}{optional && <> <span className="optional-label">{t('common.optional') || 'Optional'}</span></>}
      </label>
      <input id={id} type={type} inputMode={effectiveInputMode} className="form-control" {...props} />
    </div>
  );
};

export const EmptyState = ({ icon, title, description, action }) => (
  <div className="empty-state">
    <div className="empty-icon" aria-hidden="true"><i className={`bi ${icon}`} /></div>
    <h2>{title}</h2>
    <p>{description}</p>
    {action && <div className="empty-state-action">{action}</div>}
  </div>
);

export const LoadingState = ({ children }) => {
  const { t } = useLanguage();
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <span className="spinner-border text-success" aria-hidden="true" />
      <span>{children || t('common.loading') || 'Loading…'}</span>
    </div>
  );
};

export const ErrorState = ({ message, onRetry, retrying = false }) => {
  const { t } = useLanguage();
  return (
    <div className="alert alert-danger error-state" role="alert">
      <span>{message}</span>
      {onRetry && (
        <Button variant="outline-danger" className="btn-sm" type="button" disabled={retrying} onClick={onRetry}>
          {retrying ? (t('common.saving') || 'Retrying…') : (t('common.retry') || 'Try again')}
        </Button>
      )}
    </div>
  );
};

export const DataTable = ({ headers, children, label }) => (
  <div className="data-table-wrap">
    <table className="data-table">
      <caption className="visually-hidden">{label}</caption>
      <thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);
