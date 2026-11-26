import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  generatePassword,
  generatePassphrase,
  generatePronounceable,
  PRESETS,
  type GeneratorOptions,
} from '@/lib/password-generator';
import { calculatePasswordStrength } from '@/lib/password-strength';
import { getPasswordPolicyForUser } from '@/lib/get-user-policy';
import {
  DEFAULT_PASSWORD_POLICY,
  policyToGeneratorDefaults,
  validatePasswordAgainstPolicy,
} from '@/lib/password-policy';

export async function GET() {
  const session = await getServerSession(authOptions);
  const policy = session?.user?.id
    ? await getPasswordPolicyForUser(session.user.id)
    : { ...DEFAULT_PASSWORD_POLICY };

  return NextResponse.json({
    policy,
    defaults: policyToGeneratorDefaults(policy),
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const policy = session?.user?.id
      ? await getPasswordPolicyForUser(session.user.id)
      : { ...DEFAULT_PASSWORD_POLICY };

    const body = await req.json();
    const {
      preset,
      passphrase = false,
      pronounceable = false,
      wordCount = 4,
      separator = '-',
      capitalize = true,
      includeNumbers = true,
      count = 1,
    } = body;

    const safeCount = Math.min(Math.max(1, Number(count) || 1), 20);
    const passwords: string[] = [];
    const policyDefaults = policyToGeneratorDefaults(policy);

    if (passphrase) {
      for (let i = 0; i < safeCount; i++) {
        passwords.push(
          generatePassphrase({
            wordCount: Number(wordCount) || 4,
            separator: typeof separator === 'string' ? separator : '-',
            capitalize: capitalize !== false,
            includeNumbers: includeNumbers !== false,
          })
        );
      }
      return NextResponse.json({
        passwords,
        mode: 'passphrase',
        policy,
        strengths: passwords.map((p) => calculatePasswordStrength(p).score),
        strength: passwords[0] ? calculatePasswordStrength(passwords[0]).score : 0,
      });
    }

    if (pronounceable || preset === 'pronounceable') {
      const length = Math.max(
        policy.minLength,
        Number(body.length) || policyDefaults.length
      );
      for (let i = 0; i < safeCount; i++) {
        passwords.push(
          generatePronounceable({
            length: Math.min(policy.maxLength, length),
            capitalize: true,
            includeNumbers: body.numbers !== false && policy.requireNumber,
            includeSymbols: body.symbols === true || policy.requireSymbol,
          })
        );
      }
      return NextResponse.json({
        passwords,
        mode: 'pronounceable',
        policy,
        strengths: passwords.map((p) => calculatePasswordStrength(p).score),
        strength: passwords[0] ? calculatePasswordStrength(passwords[0]).score : 0,
      });
    }

    const base: Partial<GeneratorOptions> =
      preset && PRESETS[preset as keyof typeof PRESETS]
        ? { ...PRESETS[preset as keyof typeof PRESETS] }
        : { ...policyDefaults };

    let length = Number(body.length ?? base.length ?? policyDefaults.length);
    length = Math.min(policy.maxLength, Math.max(policy.minLength, length));

    const options: Partial<GeneratorOptions> = {
      ...base,
      length,
      uppercase: body.uppercase ?? base.uppercase ?? policy.requireUpper,
      lowercase: body.lowercase ?? base.lowercase ?? policy.requireLower,
      numbers: body.numbers ?? base.numbers ?? policy.requireNumber,
      symbols: body.symbols ?? base.symbols ?? policy.requireSymbol,
      excludeSimilar:
        body.excludeSimilar ?? base.excludeSimilar ?? policy.excludeSimilar,
      excludeAmbiguous:
        body.excludeAmbiguous ?? base.excludeAmbiguous ?? policy.excludeAmbiguous,
      excludeSequential: body.excludeSequential ?? base.excludeSequential ?? false,
      excludeChars:
        typeof body.excludeChars === 'string' ? body.excludeChars : base.excludeChars || '',
    };

    // Enforce required classes from policy
    if (policy.requireUpper) options.uppercase = true;
    if (policy.requireLower) options.lowercase = true;
    if (policy.requireNumber) options.numbers = true;
    if (policy.requireSymbol) options.symbols = true;
    if (policy.excludeAmbiguous) options.excludeAmbiguous = true;
    if (policy.excludeSimilar) options.excludeSimilar = true;

    if (!options.uppercase && !options.lowercase && !options.numbers && !options.symbols) {
      return NextResponse.json(
        { error: 'Select at least one character set' },
        { status: 400 }
      );
    }

    for (let i = 0; i < safeCount; i++) {
      let pw = generatePassword(options);
      // Retry a few times if somehow policy fails (edge charset exclusions)
      let attempts = 0;
      while (!validatePasswordAgainstPolicy(pw, policy).ok && attempts < 8) {
        pw = generatePassword(options);
        attempts++;
      }
      passwords.push(pw);
    }

    const invalid = passwords.find((p) => !validatePasswordAgainstPolicy(p, policy).ok);
    if (invalid) {
      return NextResponse.json(
        {
          error: 'Could not satisfy organization password policy with current options',
          details: validatePasswordAgainstPolicy(invalid, policy).errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      passwords,
      mode: 'password',
      options,
      policy,
      strengths: passwords.map((p) => calculatePasswordStrength(p).score),
      strength: passwords[0] ? calculatePasswordStrength(passwords[0]).score : 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
