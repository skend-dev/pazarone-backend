import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'BankAccountNumber', async: false })
export class BankAccountNumberConstraint
  implements ValidatorConstraintInterface
{
  validate(accountNumber: string, args: ValidationArguments) {
    if (!accountNumber) return false;

    // Remove spaces and dashes
    const clean = accountNumber.replace(/[\s-]/g, '');

    // Must contain only digits
    if (!/^\d+$/.test(clean)) {
      return false;
    }

    // Get bank name from the object
    const object = args.object as { bankName?: string };
    const bankName = object.bankName?.toLowerCase() || '';

    // Halkbank: 15 digits
    if (bankName.includes('halkbank') || bankName.includes('halk')) {
      return clean.length === 15;
    }

    // Other North Macedonian banks: typically 10 digits
    // But allow flexibility: 8-20 digits for other banks
    return clean.length >= 8 && clean.length <= 20;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as { bankName?: string };
    const bankName = object.bankName?.toLowerCase() || '';

    if (bankName.includes('halkbank') || bankName.includes('halk')) {
      return 'Halkbank account number must be exactly 15 digits';
    }

    return 'Account number must be 8-20 digits and contain only numbers';
  }
}

@ValidatorConstraint({ name: 'MacedoniaIban', async: false })
export class MacedoniaIbanConstraint
  implements ValidatorConstraintInterface
{
  validate(iban: string, args: ValidationArguments) {
    if (!iban) return true; // Optional field

    // Remove spaces and convert to uppercase
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();

    // Check length (must be 19 characters for North Macedonia)
    if (cleanIban.length !== 19) {
      return false;
    }

    // Check country code
    if (!cleanIban.startsWith('MK')) {
      return false;
    }

    // Validate format: MK + 2 check digits + 3 bank code + 10 account digits + 2 check digits
    if (!/^MK\d{2}[A-Z0-9]{3}\d{12}$/.test(cleanIban)) {
      return false;
    }

    // Validate IBAN checksum using MOD-97-10 algorithm
    return this.validateIbanChecksum(cleanIban);
  }

  private validateIbanChecksum(iban: string): boolean {
    // Move first 4 characters to end
    const rearranged = iban.slice(4) + iban.slice(0, 4);

    // Replace letters with numbers (A=10, B=11, ..., Z=35)
    const numeric = rearranged.replace(/[A-Z]/g, (char) => {
      return (char.charCodeAt(0) - 55).toString();
    });

    // Calculate MOD-97-10
    let remainder = '';
    for (let i = 0; i < numeric.length; i++) {
      remainder = (remainder + numeric[i]).replace(/^0+/, '');
      if (remainder.length >= 9) {
        remainder =
          (parseInt(remainder.slice(0, 9)) % 97).toString() +
          remainder.slice(9);
      }
    }
    remainder = (parseInt(remainder) % 97).toString();

    return remainder === '1';
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid North Macedonian IBAN format (must be 19 characters: MK + 2 check + 3 bank code + 10 account + 2 check)';
  }
}

