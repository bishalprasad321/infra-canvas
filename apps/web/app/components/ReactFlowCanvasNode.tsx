'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Icon } from '@iconify/react';
import { clsx } from 'clsx';
import useCanvasStore from '../store/useCanvasStore';

interface ReactFlowCanvasNodeProps {
  id: string;
  data: {
    label: string;
    tech: 'Terraform' | 'Ansible' | 'Kubernetes' | 'Source';
    icon: string;
    categoryLabel: string;
    description: string;
    status: 'Validated' | 'Warning' | 'Editing';
    statusText: string;
    editorName?: string;
  };
  selected?: boolean;
}

export default function ReactFlowCanvasNode({ id, data, selected }: ReactFlowCanvasNodeProps) {
  const { setSelectedNodeId, deleteNode } = useCanvasStore();

  const techColorClass = {
    Terraform: 'bg-primary',
    Ansible: 'bg-[#00A4FF]',
    Kubernetes: 'bg-[#326CE5]',
    Source: 'bg-[#D97706]',
  }[data.tech] || 'bg-[#00A4FF]';

  const borderClass = selected
    ? 'border-2 border-primary shadow-2xl shadow-primary/10'
    : 'border border-border hover:border-primary/50 shadow-xl';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode(id);
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setSelectedNodeId(id);
      }}
      className={clsx(
        "w-60 bg-card/90 backdrop-blur-md rounded-xl transition-all duration-200 cursor-pointer select-none relative group",
        borderClass
      )}
    >
      {/* Top tech indicator bar */}
      <div className={clsx("h-1 w-full rounded-t-xl", techColorClass)}></div>

      {selected && (
        <div className="absolute -top-3.5 left-4 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow z-20">
          Active Node
        </div>
      )}

      {/* Hover Delete Button */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1 rounded-md bg-muted/80 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all z-20 border border-border"
        title="Delete Node"
      >
        <Icon icon="lucide:trash-2" className="text-xs" />
      </button>

      <div className="p-4 relative">
        {/* Left Input Port */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !rounded-full !border-2 !border-primary !bg-background hover:!bg-primary !transition-colors !cursor-crosshair !left-[-6px] !top-1/2 !transform !-translate-y-1/2 !border-solid !opacity-100"
          style={{ position: 'absolute', zIndex: 30 }}
        />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 pr-6">
            <Icon icon={data.icon} className={clsx("text-base", data.tech === 'Terraform' ? 'text-primary' : data.tech === 'Ansible' ? 'text-[#00A4FF]' : data.tech === 'Source' ? 'text-[#D97706]' : 'text-[#326CE5]')} />
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider truncate max-w-[90px]">{data.categoryLabel}</span>
          </div>

          <div className="flex-shrink-0">
            {data.status === 'Validated' && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                <span className="h-1 w-1 rounded-full bg-emerald-400"></span> {data.statusText || 'Validated'}
              </span>
            )}

            {data.status === 'Warning' && (
              <span className="flex items-center gap-1 text-[9px] text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span> {data.statusText || 'Warning'}
              </span>
            )}

            {data.status === 'Editing' && (
              <span className="flex items-center gap-1 text-[9px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20" title={`${data.editorName || 'Sarah'} Editing`}>
                <span className="h-1 w-1 rounded-full bg-primary animate-pulse"></span> {data.editorName || 'Sarah'}
              </span>
            )}
          </div>
        </div>

        <h4 className="text-sm font-semibold text-foreground mb-1 truncate pr-2">{data.label}</h4>
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 h-[34px]">{data.description}</p>

        {/* Right Output Port */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !rounded-full !border-2 !border-primary !bg-background hover:!bg-primary !transition-colors !cursor-crosshair !right-[-6px] !top-1/2 !transform !-translate-y-1/2 !border-solid !opacity-100"
          style={{ position: 'absolute', zIndex: 30 }}
        />
      </div>
    </div>
  );
}
