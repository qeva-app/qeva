import prisma from './db';

// Rule-based password security analysis (not LLM)

interface Recommendation {
  type: 'warning' | 'suggestion' | 'info';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export async function getAIRecommendations(userId: string): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  const passwords = await prisma.passwordEntry.findMany({
    where: { userId },
    select: { strength: true, createdAt: true, updatedAt: true, expiryDate: true, category: true },
  });

  if (passwords.length === 0) {
    recommendations.push({
      type: 'info',
      title: 'Get Started',
      description: 'Add your first password to start building your secure vault.',
      priority: 'medium',
    });
    return recommendations;
  }

  // Weak passwords
  const weakCount = passwords.filter((p) => p.strength < 40).length;
  if (weakCount > 0) {
    recommendations.push({
      type: 'warning',
      title: `${weakCount} Weak Password${weakCount > 1 ? 's' : ''} Detected`,
      description: 'Update these passwords to improve your security score. Use the password generator for strong, unique passwords.',
      priority: 'high',
    });
  }

  // Old passwords (not updated in 90+ days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const staleCount = passwords.filter((p) => p.updatedAt < ninetyDaysAgo).length;
  if (staleCount > 0) {
    recommendations.push({
      type: 'suggestion',
      title: `${staleCount} Password${staleCount > 1 ? 's' : ''} Need Rotation`,
      description: 'These passwords haven\'t been changed in over 90 days. Regular rotation reduces the impact of undetected breaches.',
      priority: 'medium',
    });
  }

  // Expiring soon
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const expiringCount = passwords.filter(
    (p) => p.expiryDate && p.expiryDate <= sevenDaysFromNow && p.expiryDate > new Date()
  ).length;
  if (expiringCount > 0) {
    recommendations.push({
      type: 'warning',
      title: `${expiringCount} Password${expiringCount > 1 ? 's' : ''} Expiring Soon`,
      description: 'Update these passwords before they expire to maintain uninterrupted access.',
      priority: 'high',
    });
  }

  // Category distribution
  const categories = new Set(passwords.map((p) => p.category).filter(Boolean));
  if (categories.size === 1 && passwords.length > 5) {
    recommendations.push({
      type: 'suggestion',
      title: 'Organize with Categories',
      description: 'All your passwords are in one category. Use categories to organize and find passwords faster.',
      priority: 'low',
    });
  }

  // Security trend
  const recentPasswords = passwords.filter(
    (p) => p.createdAt > ninetyDaysAgo
  );
  if (recentPasswords.length > 0) {
    const avgStrength = Math.round(
      recentPasswords.reduce((sum, p) => sum + p.strength, 0) / recentPasswords.length
    );
    if (avgStrength > 70) {
      recommendations.push({
        type: 'info',
        title: 'Strong Security Trend',
        description: `Your recent passwords average ${avgStrength}% strength. Keep up the good work!`,
        priority: 'low',
      });
    }
  }

  // Encryption recommendation
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptionEnabled: true },
  });
  if (!user?.encryptionEnabled) {
    recommendations.push({
      type: 'suggestion',
      title: 'Enable Master-Key Encryption',
      description: 'Set up a master password for end-to-end encryption. Only you can decrypt your passwords.',
      priority: 'high',
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
