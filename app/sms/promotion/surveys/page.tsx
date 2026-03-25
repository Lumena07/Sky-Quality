import { SimpleRecordPage } from '@/components/sms/simple-record-page'

const SmsSurveysPage = () => (
  <SimpleRecordPage
    title="Safety Culture Surveys"
    endpoint="/api/sms/surveys"
    fields={[
      { key: 'title', label: 'Survey Title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'status', label: 'Status' },
      { key: 'publishedAt', label: 'Published At', type: 'date' },
      { key: 'closesAt', label: 'Closes At', type: 'date' },
    ]}
  />
)

export default SmsSurveysPage
