import { Control, Controller, FieldValues, Path, UseFormTrigger } from "react-hook-form";
import { z } from "zod";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input
} from "@app/components/v3";
import { useSubscription } from "@app/context";
import { MAX_CRL_VALIDITY_DAYS, MIN_CRL_VALIDITY_DAYS } from "@app/hooks/api/ca";

export const crlValidityDaysSchema = z.coerce
  .number()
  .int("Must be a whole number of days")
  .min(MIN_CRL_VALIDITY_DAYS, `Must be at least ${MIN_CRL_VALIDITY_DAYS} day`)
  .max(MAX_CRL_VALIDITY_DAYS, `Must be ${MAX_CRL_VALIDITY_DAYS} days or less`);

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  trigger: UseFormTrigger<T>;
  isCaExpired?: boolean;
};

export const CrlValidityDaysField = <T extends FieldValues>({
  control,
  name,
  trigger,
  isCaExpired
}: Props<T>) => {
  const { subscription } = useSubscription();

  if (!subscription?.caCrl) return null;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => {
        const handleValueChange = (value: string | number) => {
          field.onChange(value);
          if (error) trigger(name);
        };

        return (
          <Field>
            <FieldLabel htmlFor="crl-validity-days">CRL Validity (Days)</FieldLabel>
            <FieldContent>
              <Input
                {...field}
                onChange={(event) => handleValueChange(event.target.value)}
                id="crl-validity-days"
                type="number"
                disabled={isCaExpired}
                isError={Boolean(error)}
              />
              <FieldDescription>
                {isCaExpired
                  ? "This CA has expired. Renew it to change the CRL validity."
                  : `How long each CRL is valid, from ${MIN_CRL_VALIDITY_DAYS} to ${MAX_CRL_VALIDITY_DAYS} days. The CRL is regenerated automatically before it expires.`}
              </FieldDescription>
              <FieldError errors={[error]} />
            </FieldContent>
          </Field>
        );
      }}
    />
  );
};
