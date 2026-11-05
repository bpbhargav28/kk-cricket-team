import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

interface WrapperProps {
  label?: ReactNode
  error?: string
  hint?: ReactNode
  required?: boolean
  id: string
  children: ReactNode
  className?: string
}

function FieldWrapper({ label, error, hint, required, id, children, className }: WrapperProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="label" htmlFor={id}>
          {label}
          {required && <span className="ml-1 text-rose-400">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-coal-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

// `prefix` is a (deprecated) native HTML attribute typed as string, so it has
// to be omitted before being redeclared as a ReactNode.
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: ReactNode
  error?: string
  hint?: ReactNode
  /** Rendered inside the field on the left (e.g. a ₹ sign or an icon). */
  prefix?: ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, prefix, className, wrapperClassName, id, required, ...rest },
  ref
) {
  const generated = useId()
  const fieldId = id ?? generated

  return (
    <FieldWrapper
      label={label}
      error={error}
      hint={hint}
      required={required}
      id={fieldId}
      className={wrapperClassName}
    >
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-coal-400">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn('field', prefix && 'pl-9', error && 'field-error', className)}
          {...rest}
        />
      </div>
    </FieldWrapper>
  )
})

/* -------------------------------------------------------------------------- */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  error?: string
  hint?: ReactNode
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, required, rows = 3, ...rest },
  ref
) {
  const generated = useId()
  const fieldId = id ?? generated

  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} id={fieldId}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn('field resize-y', error && 'field-error', className)}
        {...rest}
      />
    </FieldWrapper>
  )
})

/* -------------------------------------------------------------------------- */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  error?: string
  hint?: ReactNode
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, className, id, required, ...rest },
  ref
) {
  const generated = useId()
  const fieldId = id ?? generated

  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} id={fieldId}>
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn('field appearance-none pr-10', error && 'field-error', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23647081' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          backgroundSize: '1.1rem',
        }}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  )
})
