import GeneratePlanButton from '@/components/GeneratePlanButton'

export default function PlanPage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-2 text-2xl font-bold text-blue-700">Study Plan</h1>
      <p className="mb-4 text-gray-600">
        Click the button to build or rebuild your schedule. Missed sessions are rescheduled automatically.
      </p>
      <GeneratePlanButton label="Generate plan / I fell behind" />
    </main>
  )
}