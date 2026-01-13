import PipelineBoard from '@/components/PipelineBoard'

export default function PipelinePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
        <p className="text-gray-500 text-sm mt-1">
          Drag and drop leads between stages to update their status
        </p>
      </div>
      <PipelineBoard />
    </div>
  )
}
