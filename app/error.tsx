'use client' // Error boundaries must be Client Components
 
import { useEffect } from 'react'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 将错误记录到错误报告服务
    console.error(error)
  }, [error])
 
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button
        className="bg-blue-500 text-white p-2 rounded-md"
        onClick={
          // 尝试通过重新渲染段来恢复
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  )
}