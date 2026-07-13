"""Base classes for scanner audit checks."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List


class BaseCheck(ABC):
    """Abstract base class for all scanner checks (e.g., security, formatting, performance)."""

    def __init__(self, name: str, description: str) -> None:
        self.name = name
        self.description = description

    @abstractmethod
    def run(self, server_metadata: Dict[str, Any]) -> List[str]:
        """Run audit validation against the server details.

        Returns a list of warnings or error strings if checks fail.
        """
        pass
