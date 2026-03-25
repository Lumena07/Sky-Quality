import { SimpleRecordPage } from '@/components/sms/simple-record-page'

const SmsLessonsPage = () => (
  <SimpleRecordPage
    title="Lessons Learned"
    endpoint="/api/sms/lessons"
    fields={[
      { key: 'title', label: 'Title', required: true },
      { key: 'summary', label: 'Summary', required: true, type: 'textarea' },
      { key: 'source', label: 'Source' },
      { key: 'details', label: 'Details', type: 'textarea' },
      { key: 'recommendedActions', label: 'Recommended Actions', type: 'textarea' },
    ]}
  />
)

export default SmsLessonsPage
