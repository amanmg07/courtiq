from pydantic import BaseModel, ConfigDict


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    abbreviation: str
    name: str
    conference: str
    division: str
