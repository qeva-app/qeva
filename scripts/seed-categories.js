// scripts/seed-categories.js
// Seed 20+ default categories for password organization
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORIES = [
  // Data Engineering
  { name: 'Data Engineering', description: 'Data engineering tools and platforms', color: '#3B82F6', icon: 'Database' },
  { name: 'Data Warehouse', description: 'Data warehouse and storage solutions', color: '#6366F1', icon: 'Warehouse' },
  { name: 'Cloud Platforms', description: 'Cloud infrastructure and services', color: '#0EA5E9', icon: 'Cloud' },
  { name: 'Data Lakes', description: 'Data lake platforms and storage', color: '#14B8A6', icon: 'Waves' },
  { name: 'Streaming Platforms', description: 'Real-time data streaming services', color: '#F59E0B', icon: 'Radio' },
  { name: 'Workflow Orchestration', description: 'Workflow and pipeline orchestration', color: '#8B5CF6', icon: 'Workflow' },

  // Data Science
  { name: 'Data Science', description: 'Data science and analytics tools', color: '#10B981', icon: 'FlaskConical' },
  { name: 'ML Platforms', description: 'Machine learning platforms', color: '#F97316', icon: 'Brain' },
  { name: 'Jupyter Notebooks', description: 'Interactive notebook environments', color: '#EF4444', icon: 'BookOpen' },
  { name: 'Model Registries', description: 'ML model versioning and registry', color: '#EC4899', icon: 'Box' },
  { name: 'Feature Stores', description: 'Feature engineering and stores', color: '#84CC16', icon: 'Layers' },

  // Professional
  { name: 'Email', description: 'Email services and providers', color: '#DC2626', icon: 'Mail' },
  { name: 'Learning Platform', description: 'Online learning and courses', color: '#7C3AED', icon: 'GraduationCap' },
  { name: 'Development Tools', description: 'Software development and IDE tools', color: '#2563EB', icon: 'Code' },
  { name: 'Databases', description: 'Database management systems', color: '#059669', icon: 'Database' },
  { name: 'Analytics Tools', description: 'Data analytics and BI tools', color: '#D97706', icon: 'BarChart3' },
  { name: 'Collaboration', description: 'Team collaboration and communication', color: '#7C3AED', icon: 'Users' },
  { name: 'Project Management', description: 'Project tracking and management', color: '#0284C7', icon: 'KanbanSquare' },
  { name: 'Documentation', description: 'Documentation and knowledge base', color: '#4F46E5', icon: 'FileText' },
  { name: 'API Services', description: 'API gateways and management', color: '#15803D', icon: 'Plug' },
];

async function seedCategories() {
  console.log('Seeding categories...');

  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {
        description: cat.description,
        color: cat.color,
        icon: cat.icon,
      },
      create: {
        name: cat.name,
        description: cat.description,
        color: cat.color,
        icon: cat.icon,
      },
    });
    console.log(`  Category: ${cat.name}`);
  }

  console.log(`${CATEGORIES.length} categories seeded successfully!`);
}

seedCategories()
  .catch((e) => {
    console.error('Error seeding categories:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
