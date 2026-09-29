"""Optional ClamAV INSTREAM document scan with fail-closed production behavior."""
import socket
import struct

from app.core.config import settings


class DocumentScanError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def scan_document_bytes(content: bytes) -> None:
    """Scan an upload when required; unavailable scanning blocks the upload."""
    if not settings.DOCUMENT_SCAN_REQUIRED:
        return

    try:
        with socket.create_connection((settings.CLAMAV_HOST, settings.CLAMAV_PORT), timeout=10) as client:
            client.sendall(b"zINSTREAM\0")
            chunk_size = 32 * 1024
            for offset in range(0, len(content), chunk_size):
                chunk = content[offset:offset + chunk_size]
                client.sendall(struct.pack("!I", len(chunk)) + chunk)
            client.sendall(struct.pack("!I", 0))

            response = client.recv(4096).decode("utf-8", errors="replace")
    except OSError as error:
        raise DocumentScanError("Document scanning is unavailable; upload was blocked.", 503) from error

    if "FOUND" in response:
        raise DocumentScanError("The uploaded document failed the security scan.", 400)
    if "OK" not in response:
        raise DocumentScanError("Document scanning returned an unexpected result; upload was blocked.", 503)
