import { ReactNode } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { InfoIcon, PlusIcon, XIcon } from "lucide-react";

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  IconButton,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@app/components/v3";

type Props = {
  control: Control<any>;
  /** The field-array name on the form (e.g. "accessTokenTrustedIps"). */
  name: string;
  /** Label rendered above the first row. */
  label: string;
  /** Optional info tooltip shown next to the label. */
  tooltip?: ReactNode;
};

/**
 * Shared editor for an identity auth method's trusted-IP constraints. Every auth
 * method supports `accessTokenTrustedIps`; Universal Auth additionally renders
 * `clientSecretTrustedIps` by using a second instance of this component.
 */
export const TrustedIpsField = ({ control, name, label, tooltip }: Props) => {
  const { fields, append, remove } = useFieldArray({ control, name });

  // At least one trusted IP is required, so the last remaining row can't be removed.
  const isLast = fields.length <= 1;

  return (
    <div className="flex flex-col gap-3">
      {fields.map(({ id }, index) => (
        <div className="flex items-start gap-2" key={id}>
          <Controller
            control={control}
            name={`${name}.${index}.ipAddress`}
            defaultValue="0.0.0.0/0"
            render={({ field, fieldState: { error } }) => (
              <Field className="flex-1">
                {index === 0 && (
                  <FieldLabel
                    htmlFor={`${name}-${index}`}
                    className={tooltip ? "inline-flex items-center gap-1.5" : undefined}
                  >
                    {label}
                    {tooltip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoIcon className="size-3.5 text-muted" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">{tooltip}</TooltipContent>
                      </Tooltip>
                    )}
                  </FieldLabel>
                )}
                <Input
                  id={`${name}-${index}`}
                  value={field.value}
                  onChange={(e) => field.onChange(e)}
                  placeholder="123.456.789.0"
                  isError={Boolean(error)}
                />
                <FieldError>{error?.message}</FieldError>
              </Field>
            )}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Wrapper span keeps the tooltip hoverable while the button is disabled. */}
              <span className={index === 0 ? "mt-[1.625rem]" : "mt-0.5"}>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove trusted IP"
                  isDisabled={isLast}
                  onClick={() => remove(index)}
                >
                  <XIcon />
                </IconButton>
              </span>
            </TooltipTrigger>
            {isLast && (
              <TooltipContent className="max-w-md">At least one IP is required</TooltipContent>
            )}
          </Tooltip>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="w-fit"
        onClick={() => append({ ipAddress: "0.0.0.0/0" })}
      >
        <PlusIcon />
        Add IP Address
      </Button>
    </div>
  );
};
