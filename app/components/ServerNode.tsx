import { Handle, Position } from '@xyflow/react';

// You can pass custom data to your nodes via the 'data' prop
export default function ServerNode({ data }: { data: { label: string; icon?: string } }) {
  return (
    // The wrapper needs standard styling. Tailwind is great for this!
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-slate-800 min-w-[150px]">
      
      {/* INPUT HANDLE: Where connections come IN (Target) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-blue-500" 
      />

      {/* NODE CONTENT */}
      <div className="flex items-center justify-center">
        <div className="text-lg font-bold text-slate-800">
          {data.icon && <span className="mr-2">{data.icon}</span>}
          {data.label}
        </div>
      </div>
      
      {/* Optional: Add more details below the label */}
      <div className="text-xs text-slate-500 text-center mt-1">Ubuntu 22.04</div>

      {/* OUTPUT HANDLE: Where connections go OUT (Source) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-blue-500" 
      />
    </div>
  );
}