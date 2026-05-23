import React from "react";
import { ShipyardDock, ShipProject } from "../types";
import { Anchor, Box } from "lucide-react";

interface DockOccupancyProps {
  docks: ShipyardDock[];
  projects: ShipProject[];
  onSelectDock: (dockId: string) => void;
}

export function DockOccupancy({ docks, projects, onSelectDock }: DockOccupancyProps) {
  const getProjectForDock = (vesselId?: string) => {
    if (!vesselId) return null;
    return projects.find((p) => p.id === vesselId);
  };

  return (
    <div className="bg-[#0f0f12] rounded-xl border border-white/10 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Anchor className="h-5 w-5 text-cyan-400 animate-pulse" />
            船坞与船台监控 (Shipyard Docks & Berths)
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">
            实时监控坞位容量负载、龙门式起重机(Quay Crane)实时载荷及工程搭载周期
          </p>
        </div>
        <div className="flex gap-3 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
            <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-ping"></span>
            <span>中控连接: 正常</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
            <span>龙门吊:</span>
            <span className="font-semibold text-cyan-400">大吨位重载 (95t)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="dock-grid">
        {docks.map((dock) => {
          const project = getProjectForDock(dock.currentVesselId);
          
          return (
            <div
              key={dock.id}
              onClick={() => onSelectDock(dock.id)}
              className={`relative cursor-pointer group rounded-xl border p-4.5 transition-all duration-200 ${
                dock.isOccupied
                  ? "bg-white/5 border-white/10 hover:border-cyan-500/50 hover:bg-white/8 transition-all"
                  : "bg-transparent border-dashed border-white/20 hover:border-cyan-500/40 hover:bg-cyan-500/5"
              }`}
            >
              {/* Top Details */}
              <div className="flex items-start justify-between mb-3">
                <span className={`text-[9px] uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded-sm ${
                  dock.type === "Dry Dock"
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    : dock.type === "Building Berth"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                }`}>
                  {dock.type === "Dry Dock" ? "干船坞" : dock.type === "Building Berth" ? "中型船台" : "舾装码头"}
                </span>

                <div className="text-right text-[10px] font-mono text-gray-500">
                  {dock.length}m × {dock.width}m
                </div>
              </div>

              {/* Title & Crane Indicator */}
              <h4 className="text-xs font-bold text-white font-sans group-hover:text-cyan-400 transition-colors flex items-center gap-1">
                {dock.name}
              </h4>

              {/* Physical Crane Mockup Visualizer inside Dock */}
              <div className="my-3.5 h-14 bg-[#0a0a0b]/80 rounded-lg p-2 border border-white/5 flex flex-col justify-between overflow-hidden relative">
                {/* Visual crane rail */}
                <div className="absolute top-1.5 left-0 right-0 h-0.5 bg-white/10 border-dashed border-b border-white/5"></div>
                {/* Movable crane core */}
                <div 
                  className="absolute top-0.5 h-4 bg-cyan-500/85 rounded-sm flex items-center transition-all duration-1000"
                  style={{ left: dock.isOccupied ? `${(project?.progress || 30) * 0.7}%` : "15%" }}
                >
                  <div className="w-5 h-2 bg-cyan-400 rounded-sm relative">
                    {/* crane line */}
                    <div className="absolute top-2 left-2 w-0.5 h-6 bg-cyan-300"></div>
                    {/* crane cargo hook */}
                    <div className="absolute top-7 left-1 bg-amber-500 w-2.5 h-2.5 rounded-xs flex items-center justify-center">
                      <div className="text-[6px] text-black leading-none font-bold">W</div>
                    </div>
                  </div>
                </div>

                <div className="z-10 text-[8px] font-mono font-bold text-gray-400 self-end bg-[#13131a]/90 px-1.5 py-0.5 rounded border border-white/5">
                  龙门起重机: {dock.isOccupied ? "工作中 (820吨/节)" : "空载待令"}
                </div>
              </div>

              {/* Vessel specs or vacant sign */}
              {dock.isOccupied && project ? (
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-sans">建造船舶:</span>
                    <span className="font-mono font-bold text-white truncate max-w-[125px]" title={project.name}>
                      {project.name}
                    </span>
                  </div>

                  {/* Stage & Progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] mb-1 font-mono">
                      <span className="text-cyan-400 font-semibold">{project.currentStage}</span>
                      <span className="text-gray-300 font-bold">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-[#1e1e24] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          project.progress > 75
                            ? "bg-emerald-500"
                            : project.progress > 40
                            ? "bg-cyan-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-gray-500 font-mono">
                    <span>船型: {project.vesselType}</span>
                    <span>{project.deadweightTons.toLocaleString()} DWT</span>
                  </div>
                </div>
              ) : (
                <div className="py-5 text-center flex flex-col items-center justify-center text-gray-500">
                  <Box className="h-5 w-5 text-gray-600 stroke-[1.5] mb-1" />
                  <span className="text-xs font-semibold text-gray-400">目前坞槽位闲置</span>
                  <p className="text-[9px] text-gray-500 mt-0.5">点击可进行排期投放与搭载</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
