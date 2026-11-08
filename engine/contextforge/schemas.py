from pydantic import BaseModel, Field

class OptimizeRequest(BaseModel):
    text: str = Field(min_length=1)
    task: str = Field(min_length=1)
    mode: str = "balanced"
    token_budget: int = Field(default=1000, ge=20, le=100000)
