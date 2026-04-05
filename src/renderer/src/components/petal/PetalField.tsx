import './PetalField.css'

type CommonProps = {
  label: string
  hint?: string
}

type InputProps = CommonProps & { as?: 'input' } & React.InputHTMLAttributes<HTMLInputElement>
type TextareaProps = CommonProps & { as: 'textarea' } & React.TextareaHTMLAttributes<HTMLTextAreaElement>

type PetalFieldProps = InputProps | TextareaProps

export default function PetalField(props: PetalFieldProps) {
  const { label, hint, as: tag = 'input', id, className, ...rest } = props

  const fieldId = id ?? `petal-field-${label.toLowerCase().replace(/\W+/g, '-')}`

  return (
    <div className="petal-field">
      <label className="petal-field__label" htmlFor={fieldId}>
        {label}
        {hint ? <span className="petal-field__hint">{hint}</span> : null}
      </label>
      {tag === 'textarea' ? (
        <textarea
          id={fieldId}
          className={`petal-field__input petal-field__input--textarea${className ? ` ${className}` : ''}`}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={fieldId}
          className={`petal-field__input${className ? ` ${className}` : ''}`}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
    </div>
  )
}
