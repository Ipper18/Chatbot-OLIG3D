from fastapi import FastAPI, File, UploadFile
import io
import trimesh
import numpy as np

app = FastAPI(
    title="OLIG3D Geometry Service",
    description="Analiza modeli STL/OBJ dla projektu Chatbot-OLIG3D",
    version="0.1.1",
)

@app.post("/analyze")
async def analyze_model(file: UploadFile = File(...)):
    """
    Zwraca: objętość, powierzchnię, bounding box i precyzyjne wymiary X/Y/Z.
    """
    data = await file.read()
    filename_lower = file.filename.lower()
    
    # Wykrywanie typu pliku
    file_type = 'stl'
    if filename_lower.endswith('.obj'):
        file_type = 'obj'
    
    try:
        # Wczytanie siatki
        mesh = trimesh.load(io.BytesIO(data), file_type=file_type)

        # Obsługa Sceny (gdy plik zawiera wiele obiektów)
        if isinstance(mesh, trimesh.Scene):
            if len(mesh.geometry) == 0:
                return {"error": "Empty scene"}
            # Łączymy geometrie w jedną
            mesh = trimesh.util.concatenate(
                tuple(trimesh.util.concatenate(g) for g in mesh.geometry.values())
            )

        # Objętość: mm^3 -> cm^3
        # Jeśli siatka nie jest szczelna (not watertight), używamy convex_hull jako przybliżenia
        volume_mm3 = mesh.volume if mesh.is_watertight else mesh.convex_hull.volume
        volume_cm3 = float(volume_mm3) / 1000.0

        # Powierzchnia: mm^2 -> cm^2
        surface_cm2 = float(mesh.area) / 100.0

        # Bounding Box
        bbox = mesh.bounds # [[minX, minY, minZ], [maxX, maxY, maxZ]]
        
        # Obliczanie wymiarów
        size_x = float(bbox[1][0] - bbox[0][0])
        size_y = float(bbox[1][1] - bbox[0][1])
        size_z = float(bbox[1][2] - bbox[0][2])

        return {
            "filename": file.filename,
            "volume_cm3": round(volume_cm3, 2),
            "surface_cm2": round(surface_cm2, 2),
            # Zwracamy w formacie listy list (zgodnym z JSON)
            "bounding_box": bbox.tolist(),
            # Dodatkowo zwracamy obliczone wymiary, aby odciążyć n8n
            "dimensions_mm": {
                "x": round(size_x, 2),
                "y": round(size_y, 2),
                "z": round(size_z, 2)
            },
            "height_mm": round(size_z, 2),
            "is_watertight": mesh.is_watertight
        }

    except Exception as e:
        return {"error": str(e)}

@app.get("/health")
def health():
    return {"status": "ok"}