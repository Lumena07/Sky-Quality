export type UserGuideMenuItem = {
  label: string
  description: string
}

export type UserGuideMenuSection = {
  sectionName: string
  items: UserGuideMenuItem[]
}

export type UserGuideWhereToGo = {
  task: string
  link: string
}

export type UserGuideRoleContent = {
  title: string
  purpose: string
  scope: string
  menuSections: UserGuideMenuSection[]
  whereToGo: UserGuideWhereToGo[]
}

export type UserGuideRoleId =
  | 'qualityManager'
  | 'accountableManager'
  | 'auditor'
  | 'staffAndDeptHead'
  | 'focalPerson'

export const USER_GUIDE_CONTENT: Record<UserGuideRoleId, UserGuideRoleContent> = {
  qualityManager: {
    title: 'Quality Manager',
    purpose:
      'This guide helps you navigate Sky SQ QMS in your role as Quality Manager. Use it to find where to perform common tasks and to understand the main areas available to you.',
    scope:
      'Your access covers the full system: overview and reporting, quality policy and objectives, quality programme and audit execution, findings and corrective actions, document control, training records, performance metrics, and system administration.',
    menuSections: [
      {
        sectionName: 'Overview',
        items: [
          {
            label: 'Dashboard',
            description: 'View a summary of audits, findings, documents, and training across the system.',
          },
        ],
      },
      {
        sectionName: 'Core tasks',
        items: [
          {
            label: 'Quality Policy & Objectives',
            description: 'View and manage the quality policy and objectives.',
          },
          {
            label: 'Findings & CAP',
            description: 'View all findings and corrective action plans; review and approve where needed.',
          },
        ],
      },
      {
        sectionName: 'Audit management',
        items: [
          {
            label: 'Quality Assurance',
            description:
              'Sidebar section: expand it to open Quality Programme, Audits, Findings & CAP, and Checklists.',
          },
          {
            label: 'Quality Programme',
            description: 'View and edit recurring audits in the quality programme.',
          },
          {
            label: 'Audits',
            description: 'Schedule, run, and manage all audits.',
          },
          {
            label: 'Checklists',
            description: 'Create and edit checklist templates for audits.',
          },
        ],
      },
      {
        sectionName: 'Document management',
        items: [
          {
            label: 'Documents',
            description: 'View, review, approve, and manage controlled documents and their versions.',
          },
        ],
      },
      {
        sectionName: 'Training',
        items: [
          {
            label: 'Training',
            description: 'View and manage training and qualification records.',
          },
          {
            label: 'Quality team register',
            description:
              'Single view of Quality department members and Accountable Managers with their qualifications and training.',
          },
        ],
      },
      {
        sectionName: 'Reporting and performance',
        items: [
          {
            label: 'Performance',
            description: 'View KPIs and period summaries.',
          },
        ],
      },
      {
        sectionName: 'Administration',
        items: [
          {
            label: 'Activity Log',
            description: 'View system activity history.',
          },
          {
            label: 'Admin',
            description: 'Manage users and system settings.',
          },
        ],
      },
    ],
    whereToGo: [
      { task: 'View system-wide stats and recent activity', link: 'Dashboard' },
      { task: 'Schedule or manage an audit', link: 'Audits' },
      { task: 'Review or approve a finding or CAP', link: 'Findings & CAP' },
      {
        task: 'View Quality team competence (QM, AM, auditors roster)',
        link: 'Quality team register',
      },
      { task: 'Manage users and settings', link: 'Admin' },
      { task: 'Change your password', link: 'Change password (sidebar footer)' },
    ],
  },
  accountableManager: {
    title: 'Accountable Manager',
    purpose:
      'This guide helps you navigate Sky SQ QMS in your role as Accountable Manager. Use it to find where to perform common tasks and to understand the main areas available to you.',
    scope:
      'Your access covers oversight and reporting: the AM dashboard, quality policy and objectives, quality programme and audits, findings and corrective actions, documents, training, and performance. You do not have access to system administration.',
    menuSections: [
      {
        sectionName: 'Overview',
        items: [
          {
            label: 'AM Dashboard',
            description: 'View oversight metrics and escalation information.',
          },
        ],
      },
      {
        sectionName: 'Core tasks',
        items: [
          {
            label: 'Quality Policy & Objectives',
            description: 'View the quality policy and objectives.',
          },
          {
            label: 'Findings & CAP',
            description: 'View findings and corrective actions.',
          },
        ],
      },
      {
        sectionName: 'Audit management',
        items: [
          {
            label: 'Quality Assurance',
            description:
              'Sidebar section: expand it to open Quality Programme, Audits, Findings & CAP, and Checklists.',
          },
          {
            label: 'Quality Programme',
            description: 'View the quality programme (recurring audits).',
          },
          {
            label: 'Audits',
            description: 'View audits and approve reschedule requests when needed.',
          },
          {
            label: 'Checklists',
            description: 'View checklist templates.',
          },
        ],
      },
      {
        sectionName: 'Document management',
        items: [
          {
            label: 'Documents',
            description: 'View controlled documents.',
          },
        ],
      },
      {
        sectionName: 'Training',
        items: [
          {
            label: 'Training',
            description: 'View training and qualification records.',
          },
          {
            label: 'Quality team register',
            description:
              'See Quality department staff and Accountable Managers with qualifications and training in one place.',
          },
        ],
      },
      {
        sectionName: 'Reporting and performance',
        items: [
          {
            label: 'Performance',
            description: 'View KPIs and period summaries.',
          },
        ],
      },
    ],
    whereToGo: [
      { task: 'View oversight metrics and escalations', link: 'AM Dashboard' },
      { task: 'Approve an audit reschedule request', link: 'Audits' },
      { task: 'View the quality programme', link: 'Quality Programme' },
      { task: 'View training records', link: 'Training' },
      {
        task: 'View Quality team competence register',
        link: 'Quality team register',
      },
      { task: 'Change your password', link: 'Change password (sidebar footer)' },
    ],
  },
  auditor: {
    title: 'Auditor',
    purpose:
      'This guide helps you navigate Sky SQ QMS in your role as Auditor. Use it to find where to perform common tasks and to understand the main areas available to you.',
    scope:
      'Your access covers audits you are assigned to, the quality programme, checklists, findings and corrective actions, documents, training, and performance reporting. You do not have access to system administration.',
    menuSections: [
      {
        sectionName: 'Overview',
        items: [
          {
            label: 'Dashboard',
            description: 'View a summary of audits, findings, and your activity.',
          },
        ],
      },
      {
        sectionName: 'Core tasks',
        items: [
          {
            label: 'Quality Policy & Objectives',
            description: 'View the quality policy and objectives.',
          },
          {
            label: 'Findings & CAP',
            description: 'Create findings and review corrective action plans for your audits.',
          },
        ],
      },
      {
        sectionName: 'Audit management',
        items: [
          {
            label: 'Quality Assurance',
            description:
              'Sidebar section: expand it to open Quality Programme, Audits, Findings & CAP, and Checklists.',
          },
          {
            label: 'Quality Programme',
            description: 'View the quality programme (recurring audits).',
          },
          {
            label: 'Audits',
            description: 'Schedule and run audits you are assigned to.',
          },
          {
            label: 'Checklists',
            description: 'Create and edit checklist templates.',
          },
        ],
      },
      {
        sectionName: 'Document management',
        items: [
          {
            label: 'Documents',
            description: 'View and work with controlled documents.',
          },
        ],
      },
      {
        sectionName: 'Training',
        items: [
          {
            label: 'Training',
            description: 'View and add training records.',
          },
          {
            label: 'Quality team register',
            description:
              'View Quality department members and Accountable Managers with qualifications and training (available even if you are not in the Quality department).',
          },
        ],
      },
      {
        sectionName: 'Reporting and performance',
        items: [
          {
            label: 'Performance',
            description: 'View KPIs and period summaries.',
          },
        ],
      },
    ],
    whereToGo: [
      { task: 'Schedule a new audit', link: 'Audits' },
      { task: 'Work on an audit (checklist, findings)', link: 'Audits' },
      { task: 'Create or edit a checklist template', link: 'Checklists' },
      { task: 'Add or review a finding', link: 'Findings & CAP' },
      {
        task: 'View Quality team competence register',
        link: 'Quality team register',
      },
      { task: 'Change your password', link: 'Change password (sidebar footer)' },
    ],
  },
  staffAndDeptHead: {
    title: 'Staff & Department Head',
    purpose:
      'This guide helps you navigate Sky SQ QMS in your role. Use it to find where to perform common tasks and to understand the main areas available to you.',
    scope:
      'Your access covers your dashboard, findings assigned to you, documents (including approvals for your department), training where applicable, and the quality policy and objectives. You do not have access to audit management or system administration.',
    menuSections: [
      {
        sectionName: 'Overview',
        items: [
          {
            label: 'Dashboard',
            description: 'View a summary of your assigned items and recent activity.',
          },
        ],
      },
      {
        sectionName: 'Core tasks',
        items: [
          {
            label: 'Findings & CAP',
            description: 'View findings assigned to you and complete root cause and corrective action plans.',
          },
          {
            label: 'Quality Policy & Objectives',
            description: 'View the quality policy and objectives.',
          },
        ],
      },
      {
        sectionName: 'Document management',
        items: [
          {
            label: 'Documents',
            description: 'View approved documents and approve documents for your department when required.',
          },
        ],
      },
      {
        sectionName: 'Training',
        items: [
          {
            label: 'Training',
            description: 'View training records where you have access.',
          },
        ],
      },
    ],
    whereToGo: [
      { task: 'View your assigned findings and due dates', link: 'Findings & CAP' },
      { task: 'Complete root cause or CAP for a finding', link: 'Findings & CAP' },
      { task: 'View or approve documents', link: 'Documents' },
      { task: 'Read the quality policy', link: 'Quality Policy & Objectives' },
      { task: 'Change your password', link: 'Change password (sidebar footer)' },
    ],
  },
  focalPerson: {
    title: 'Focal Person',
    purpose:
      'This guide helps you navigate Sky SQ QMS in your role as Focal Person. Use it to find where to perform common tasks and to understand the main areas available to you.',
    scope:
      'Your access is limited to the dashboard and findings assigned to you. You can view and work on those findings and their corrective action plans.',
    menuSections: [
      {
        sectionName: 'Overview',
        items: [
          {
            label: 'Dashboard',
            description: 'View a brief overview and quick links.',
          },
        ],
      },
      {
        sectionName: 'Core tasks',
        items: [
          {
            label: 'Findings & CAP',
            description: 'View findings assigned to you and complete root cause and corrective action plans.',
          },
        ],
      },
    ],
    whereToGo: [
      { task: 'View findings assigned to you', link: 'Findings & CAP' },
      { task: 'Complete root cause or CAP for a finding', link: 'Findings & CAP' },
      { task: 'Change your password', link: 'Change password (sidebar footer)' },
    ],
  },
}

export const USER_GUIDE_ROLE_IDS: UserGuideRoleId[] = [
  'qualityManager',
  'accountableManager',
  'auditor',
  'staffAndDeptHead',
  'focalPerson',
]

const ROLE_TO_GUIDE_ID: Array<{ apiRole: string; guideId: UserGuideRoleId }> = [
  { apiRole: 'QUALITY_MANAGER', guideId: 'qualityManager' },
  { apiRole: 'ACCOUNTABLE_MANAGER', guideId: 'accountableManager' },
  { apiRole: 'AUDITOR', guideId: 'auditor' },
  { apiRole: 'FOCAL_PERSON', guideId: 'focalPerson' },
  { apiRole: 'STAFF', guideId: 'staffAndDeptHead' },
  { apiRole: 'DEPARTMENT_HEAD', guideId: 'staffAndDeptHead' },
]

/** Maps API roles from /api/me to a single UserGuideRoleId. Priority order: QM, AM, Auditor, Focal, then Staff/DeptHead. */
export const getUserGuideRoleId = (roles: string[]): UserGuideRoleId => {
  for (const { apiRole, guideId } of ROLE_TO_GUIDE_ID) {
    if (roles.includes(apiRole)) return guideId
  }
  return 'staffAndDeptHead'
}
