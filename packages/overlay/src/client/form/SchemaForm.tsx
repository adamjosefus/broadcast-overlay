import { Option, Predicate, Result, Schema, SchemaAST } from "effect"
import { useId, useState } from "react"
import { Input, NativeSelect, Textarea } from "../ui/input.tsx"
import { Label } from "../ui/label.tsx"
import { Switch } from "../ui/switch.tsx"

/**
 * Editor form generated from a schema AST. Structure and labels (`title`,
 * `description` annotations) come from the type side; values are edited as
 * encoded data and validated by the feature schema afterwards.
 */
export const SchemaForm = ({
  ast,
  value,
  onChange,
}: {
  readonly ast: SchemaAST.AST
  readonly value: unknown
  readonly onChange: (value: unknown) => void
}) => <Field ast={SchemaAST.toType(ast)} value={value} onChange={onChange} label={Option.none()} />

const getProperty = (value: unknown, key: string): unknown =>
  Predicate.isObject(value) && Predicate.hasProperty(value, key) ? value[key] : undefined

const setProperty = (value: unknown, key: string, next: unknown): unknown => ({
  ...(Predicate.isObject(value) ? value : {}),
  [key]: next,
})

const literalOptions = (ast: SchemaAST.AST): Option.Option<ReadonlyArray<SchemaAST.LiteralValue>> =>
  SchemaAST.isUnion(ast)
    ? Option.all(
        ast.types.map((member) =>
          SchemaAST.isLiteral(member) ? Option.some(member.literal) : Option.none(),
        ),
      )
    : Option.none()

interface FieldProps {
  readonly ast: SchemaAST.AST
  readonly value: unknown
  readonly onChange: (value: unknown) => void
  readonly label: Option.Option<string>
}

const FieldShell = ({
  id,
  label,
  description,
  inline = false,
  children,
}: {
  readonly id: string
  readonly label: Option.Option<string>
  readonly description: Option.Option<string>
  readonly inline?: boolean
  readonly children: React.ReactNode
}) => (
  <div className={inline ? "flex items-center justify-between gap-3" : "grid gap-2"}>
    {Option.match(label, { onNone: () => null, onSome: (text) => <Label htmlFor={id}>{text}</Label> })}
    {children}
    {Option.match(description, {
      onNone: () => null,
      onSome: (text) => <p className="text-xs text-muted-foreground">{text}</p>,
    })}
  </div>
)

const Field = ({ ast, value, onChange, label }: FieldProps) => {
  const id = useId()
  const title = Option.orElse(Option.fromUndefinedOr(SchemaAST.resolveTitle(ast)), () => label)
  const description = Option.fromUndefinedOr(SchemaAST.resolveDescription(ast))

  if (SchemaAST.isObjects(ast) && ast.indexSignatures.length === 0) {
    return (
      <fieldset className="grid gap-4">
        {ast.propertySignatures.flatMap(({ name, type }) =>
          Predicate.isString(name)
            ? [
                <Field
                  key={name}
                  ast={type}
                  label={Option.some(name)}
                  value={getProperty(value, name)}
                  onChange={(next) => onChange(setProperty(value, name, next))}
                />,
              ]
            : [],
        )}
      </fieldset>
    )
  }

  if (SchemaAST.isString(ast)) {
    return (
      <FieldShell id={id} label={title} description={description}>
        <Input
          id={id}
          value={Predicate.isString(value) ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </FieldShell>
    )
  }

  if (SchemaAST.isNumber(ast)) {
    return (
      <FieldShell id={id} label={title} description={description}>
        <Input
          id={id}
          type="number"
          value={Predicate.isNumber(value) ? value : ""}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
      </FieldShell>
    )
  }

  if (SchemaAST.isBoolean(ast)) {
    return (
      <FieldShell id={id} label={title} description={description} inline>
        <Switch id={id} checked={value === true} onCheckedChange={onChange} />
      </FieldShell>
    )
  }

  return Option.match(literalOptions(ast), {
    onSome: (options) => (
      <FieldShell id={id} label={title} description={description}>
        <NativeSelect
          id={id}
          value={String(value)}
          onChange={(e) =>
            onChange(options.find((option) => String(option) === e.target.value) ?? e.target.value)
          }
        >
          {options.map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </NativeSelect>
      </FieldShell>
    ),
    onNone: () => (
      <FieldShell id={id} label={title} description={description}>
        <JsonField id={id} value={value} onChange={onChange} />
      </FieldShell>
    ),
  })
}

const parseJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown))

/** Fallback editor for schemas without a dedicated widget. */
const JsonField = ({
  id,
  value,
  onChange,
}: {
  readonly id: string
  readonly value: unknown
  readonly onChange: (value: unknown) => void
}) => {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  const [invalid, setInvalid] = useState(false)
  return (
    <Textarea
      id={id}
      aria-invalid={invalid}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const parsed = parseJson(e.target.value)
        setInvalid(Result.isFailure(parsed))
        if (Result.isSuccess(parsed)) {
          onChange(parsed.success)
        }
      }}
    />
  )
}
