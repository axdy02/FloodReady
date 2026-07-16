from dataclasses import dataclass
from io import BytesIO
from typing import Literal

from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.datastructures import UploadFile

from app.errors import ServiceError


@dataclass(frozen=True, slots=True)
class PreparedImage:
    content: bytes
    mime_type: Literal["image/jpeg"]
    width: int
    height: int


_FORMAT_MIME = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


async def read_and_prepare_upload(
    upload: UploadFile,
    claimed_mime_type: str,
    max_bytes: int,
    max_pixels: int,
    max_dimension: int,
) -> PreparedImage:
    try:
        content = await upload.read(max_bytes + 1)
    finally:
        await upload.close()
    if len(content) > max_bytes:
        raise ServiceError(413, "IMAGE_TOO_LARGE")
    if len(content) == 0:
        raise ServiceError(422, "INVALID_IMAGE")
    if upload.content_type != claimed_mime_type:
        raise ServiceError(415, "UNSUPPORTED_MEDIA_TYPE")
    return prepare_image(content, claimed_mime_type, max_pixels, max_dimension)


def prepare_image(content: bytes, claimed_mime_type: str, max_pixels: int, max_dimension: int) -> PreparedImage:
    try:
        with Image.open(BytesIO(content)) as source:
            actual_mime_type = _FORMAT_MIME.get(source.format or "")
            if actual_mime_type is None or actual_mime_type != claimed_mime_type:
                raise ServiceError(415, "UNSUPPORTED_MEDIA_TYPE")
            width, height = source.size
            if width <= 0 or height <= 0 or width * height > max_pixels:
                raise ServiceError(422, "INVALID_IMAGE")
            source.load()
            oriented = ImageOps.exif_transpose(source)
            prepared = oriented.convert("RGB")
            prepared.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            output = BytesIO()
            prepared.save(output, format="JPEG", quality=85, optimize=True)
            result_width, result_height = prepared.size
            return PreparedImage(
                content=output.getvalue(),
                mime_type="image/jpeg",
                width=result_width,
                height=result_height,
            )
    except ServiceError:
        raise
    except (Image.DecompressionBombError, OSError, SyntaxError, UnidentifiedImageError, ValueError) as error:
        raise ServiceError(422, "INVALID_IMAGE") from error
