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
    Przyjmuje STL/OBJ, zwraca:
    - objętość [cm3]
    - powierzchnia [cm2]
    - wymiary bounding box (x, y, z) [mm]
    """
    data = await file.read()
    filename_lower = file.filename.lower()
    
    # Wykrywanie rozszerzenia
    file_type = 'stl' # domyślnie
    if filename_lower.endswith('.obj'):
        file_type = 'obj'
    
    try:
        # Wczytanie siatki
        mesh = trimesh.load(io.BytesIO(data), file_type=file_type)

        # Jeśli wczytano 'Scene' (częste przy OBJ), bierzemy pierwszą geometrię lub łączymy
        if isinstance(mesh, trimesh.Scene):
            if len(mesh.geometry) == 0:
                return {"error": "Empty scene"}
            # Łączymy wszystkie geometrie w jedną dla celów obliczeń
            mesh = trimesh.util.concatenate(
                tuple(trimesh.util.concatenate(g) for g in mesh.geometry.values())
            )

        # Objętość: mm^3 -> cm^3
        # Niektóre siatki nie są zamknięte (watertight), wtedy volume może być niedokładne
        volume_mm3 = mesh.volume if mesh.is_watertight else mesh.convex_hull.volume
        volume_cm3 = float(volume_mm3) / 1000.0

        # Powierzchnia: mm^2 -> cm^2
        surface_cm2 = float(mesh.area) / 100.0

        # Bounding Box (granice modelu)
        # bounds zwraca [[min_x, min_y, min_z], [max_x, max_y, max_z]]
        bbox = mesh.bounds
        min_point = bbox[0]
        max_point = bbox[1]

        # Obliczanie wymiarów w mm
        size_x = float(max_point[0] - min_point[0]) # Szerokość
        size_y = float(max_point[1] - min_point[1]) # Głębokość
        size_z = float(max_point[2] - min_point[2]) # Wysokość

        # Proste wskaźniki (placeholdery)
        face_count = len(mesh.faces)
        
        return {
            "filename": file.filename,
            "volume_cm3": round(volume_cm3, 2),
            "surface_cm2": round(surface_cm2, 2),
            "dimensions_mm": {
                "x": round(size_x, 2),
                "y": round(size_y, 2),
                "z": round(size_z, 2)
            },
            "bounding_box": bbox.tolist(), # Dla kompatybilności wstecznej
            "is_watertight": mesh.is_watertight,
            "face_count": face_count
        }

    except Exception as e:
        return {"error": str(e)}

@app.get("/health")
def health():
    return {"status": "ok"}