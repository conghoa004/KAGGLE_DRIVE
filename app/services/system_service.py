import os
import shutil
import platform
import subprocess
from typing import Dict, Any

try:
    import psutil
except ImportError:
    psutil = None

from app.config import settings
from app.services.file_service import format_size


class SystemService:

    @staticmethod
    def get_disk_info() -> Dict[str, Any]:
        """Get usage for the filesystem containing ROOT_DIR."""
        try:
            total, used, free = shutil.disk_usage(settings.ROOT_DIR)
            percent = round((used / total) * 100, 1) if total > 0 else 0
            return {
                "status": "available",
                "total": total,
                "used": used,
                "free": free,
                "percent": percent,
                "total_formatted": format_size(total),
                "used_formatted": format_size(used),
                "free_formatted": format_size(free),
            }
        except Exception:
            return {
                "status": "unavailable",
                "total": 0, "used": 0, "free": 0, "percent": None,
                "total_formatted": "N/A", "used_formatted": "N/A", "free_formatted": "N/A"
            }

    @staticmethod
    def get_memory_info() -> Dict[str, Any]:
        """Get system RAM statistics, falling back to Linux /proc/meminfo."""
        if psutil:
            try:
                mem = psutil.virtual_memory()
                return {
                    "status": "available",
                    "total": mem.total,
                    "used": mem.used,
                    "available": mem.available,
                    "percent": mem.percent,
                    "total_formatted": format_size(mem.total),
                    "used_formatted": format_size(mem.used),
                    "free_formatted": format_size(mem.available),
                }
            except Exception:
                pass

        if os.path.exists("/proc/meminfo"):
            try:
                meminfo = {}
                with open("/proc/meminfo", "r", encoding="ascii") as f:
                    for line in f:
                        parts = line.split(":")
                        if len(parts) == 2:
                            meminfo[parts[0].strip()] = int(parts[1].split()[0].strip()) * 1024
                total = meminfo.get("MemTotal", 0)
                available = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))
                if total > 0:
                    used = max(0, total - available)
                    percent = round((used / total) * 100, 1)
                    return {
                        "status": "available",
                        "total": total,
                        "used": used,
                        "available": available,
                        "percent": percent,
                        "total_formatted": format_size(total),
                        "used_formatted": format_size(used),
                        "free_formatted": format_size(available),
                    }
            except Exception:
                pass

        return {
            "status": "unavailable",
            "total": 0, "used": 0, "available": 0, "percent": None,
            "total_formatted": "N/A", "used_formatted": "N/A", "free_formatted": "N/A"
        }

    @staticmethod
    def get_cpu_info() -> Dict[str, Any]:
        """Sample system CPU utilization over a short interval."""
        if psutil:
            try:
                percent = psutil.cpu_percent(interval=0.25)
                cores = psutil.cpu_count(logical=True)
                return {"status": "available", "percent": percent, "cores": cores}
            except Exception:
                pass
        return {"status": "unavailable", "percent": None, "cores": os.cpu_count() or 1}

    @staticmethod
    def get_gpu_info() -> Dict[str, Any]:
        """Query all NVIDIA GPUs and distinguish absence from query failures."""
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu",
                    "--format=csv,noheader,nounits"
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=3
            )
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            return {"status": "query_error"}
        except Exception:
            return {"status": "query_error"}

        output = (result.stdout or "").strip()
        error_text = f"{result.stderr or ''}\n{output}".lower()
        if result.returncode != 0:
            if any(message in error_text for message in (
                "no devices were found", "no devices detected", "no devices found"
            )):
                return {"status": "not_found"}
            return {"status": "query_error"}
        if not output:
            return {"status": "query_error"}

        try:
            devices = []
            for line in output.splitlines():
                parts = [part.strip() for part in line.split(",")]
                if len(parts) < 5:
                    return {"status": "query_error"}
                name = parts[0]
                total_mb, used_mb, free_mb, utilization = map(float, parts[1:5])
                devices.append({
                    "name": name,
                    "vram_total": f"{total_mb / 1024:.1f} GB",
                    "vram_used": f"{used_mb / 1024:.1f} GB",
                    "vram_free": f"{free_mb / 1024:.1f} GB",
                    "vram_percent": round((used_mb / total_mb) * 100, 1) if total_mb > 0 else 0,
                    "utilization_percent": utilization,
                })
            if not devices:
                return {"status": "query_error"}
            return {"status": "available", "devices": devices}
        except (TypeError, ValueError, IndexError):
            return {"status": "query_error"}

    @classmethod
    def get_full_stats(cls) -> Dict[str, Any]:
        """Aggregate all system statistics."""
        return {
            "disk": cls.get_disk_info(),
            "memory": cls.get_memory_info(),
            "cpu": cls.get_cpu_info(),
            "gpu": cls.get_gpu_info(),
            "os": f"{platform.system()} {platform.release()}",
            "python": platform.python_version(),
            "root_dir": str(settings.ROOT_DIR)
        }

