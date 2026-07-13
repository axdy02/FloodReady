from pydantic import BaseModel


class StatusData(BaseModel):
    status: str


class SuccessEnvelope(BaseModel):
    success: bool
    data: StatusData
    requestId: str
