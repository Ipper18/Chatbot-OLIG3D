from fastapi import FastAPI, File, UploadFile
import io
import trimesh

app = FastAPI(
    title="OLIG3D Geometry Service",
    description="Analiza modeli STL/OBJ dla projektu Chatbot-OLIG3D",
    version="0.1.0",
)


@app.post("/analyze")
async def analyze_model(file: UploadFile = File(...)):
    """
    Przyjmuje STL/OBJ, zwraca podstawowe cechy:
    - objętość [cm3]
    - powierzchnia [cm2]
    - bounding box
    - wysokość Z
    - proste wskaźniki trudności (placeholdery na M2)
    """
    data = await file.read()
    file_ext = file.filename.split(".")[-1].lower()

    # Wczytanie siatki
    mesh = trimesh.load(io.BytesIO(data), file_type=file_ext)

    # mm^3 -> cm^3
    volume_cm3 = float(mesh.volume) / 1000.0
    # mm^2 -> cm^2
    surface_cm2 = float(mesh.area) / 100.0

    bbox = mesh.bounds.tolist()  # [[minx, miny, minz], [maxx, maxy, maxz]]
    height_mm = bbox[1][2] - bbox[0][2]

    # Bardzo proste, ale wystarczy na M2 – później poprawimy
    face_count = mesh.faces.shape[0]
    overhang_index = float(face_count) / 10000.0
    thin_wall_index = 0.0

    return {
        "filename": file.filename,
        "volume_cm3": volume_cm3,
        "surface_cm2": surface_cm2,
        "bbox_mm": bbox,
        "height_mm": height_mm,
        "overhang_index": overhang_index,
        "thin_wall_index": thin_wall_index,
    }
