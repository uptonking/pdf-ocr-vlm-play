# -*- encoding: utf-8 -*-
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import uvicorn
import numpy as np
import uuid
from rapidocr.main import RapidOCR
from rapidocr.utils.to_json import to_json
from rapidocr.utils.to_markdown import to_markdown
from rapidocr.utils import VisRes
import cv2
import os
import json
import time

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

app.mount("/output", StaticFiles(directory="output"), name="output")
app.mount("/web", StaticFiles(directory="web"), name="web")

ocr_engine = RapidOCR()


def process_ocr_result(result, width, height):
    """Process OCR result and return elements array"""
    if not hasattr(result, "boxes") or result.boxes is None or not hasattr(result, "txts") or result.txts is None or not hasattr(result, "scores") or result.scores is None:
        return []
    else:
        json_str = to_json(result)
        ocr_data = json.loads(json_str)
        return [
            {
                "id": f"el_{i}",
                "role": "field",
                "type": "text",
                "bbox": [
                    int(min(pt[0] for pt in item["box"])),
                    int(min(pt[1] for pt in item["box"])),
                    int(max(pt[0] for pt in item["box"])),
                    int(max(pt[1] for pt in item["box"]))
                ] if "box" in item else [0, 0, 0, 0],
                "text": item.get("txt", ""),
                "confidence": item.get("score", 1.0)
            }
            for i, item in enumerate(ocr_data)
        ]


@app.post("/ocr")
async def ocr_api(
    file: UploadFile = File(...),
    return_vis: bool = Form(False),
    return_json: bool = Form(True),
    return_markdown: bool = Form(False)
):
    file_id = str(uuid.uuid4())
    input_path = OUTPUT_DIR / f"{file_id}_input.png"
    with input_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    # Run OCR
    result = ocr_engine(str(input_path))

    output = {}
    if return_json:
        json_path = OUTPUT_DIR / f"{file_id}_output.json"
        json_str = to_json(result)
        with json_path.open("w", encoding="utf-8") as f:
            f.write(json_str)
        output["json_path"] = f"/output/{json_path.name}"
        output["json"] = json_str
    if return_markdown:
        md_path = OUTPUT_DIR / f"{file_id}_output.md"
        markdown_str = to_markdown(result)
        with md_path.open("w", encoding="utf-8") as f:
            f.write(markdown_str)
        output["markdown_path"] = f"/output/{md_path.name}"
        output["markdown"] = markdown_str
    if return_vis:
        vis = VisRes(text_score=0.5, font_path=None, lang_type=None)
        vis_img = vis(str(input_path), result.boxes, result.txts, result.scores)
        vis_path = OUTPUT_DIR / f"{file_id}_vis.png"
        cv2.imwrite(str(vis_path), vis_img)
        output["vis_img_path"] = f"/output/{vis_path.name}"
    return JSONResponse(content=output)


@app.post("/upload")
async def upload_file_api(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix or ".png"
    save_path = OUTPUT_DIR / f"{file_id}{ext}"
    with save_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    # Handle PDF files
    if ext.lower() == ".pdf":
        from pdf2image import convert_from_path
        # Convert first page of PDF to image
        images = convert_from_path(str(save_path), dpi=300, first_page=1, last_page=1)
        if images:
            # Save the first page as image for OCR
            pdf_image_path = OUTPUT_DIR / f"{file_id}_page.png"
            images[0].save(pdf_image_path, "PNG")
            width, height = images[0].width, images[0].height
            result = ocr_engine(str(pdf_image_path))
            # Return PDF URL for frontend rendering
            return JSONResponse(content={
                "success": True,
                "data": {
                    "documentId": f"doc_{int(time.time())}_{file_id[:8]}",
                    "pdfUrl": f"/output/{save_path.name}",
                    "pages": [{
                        "pageIndex": 0,
                        "pageSize": {"width": width, "height": height},
                        "dpi": 300,
                        "rotation": 0,
                        "elements": process_ocr_result(result, width, height)
                    }]
                }
            })
        else:
            return JSONResponse(content={"success": False, "error": "Failed to convert PDF"}, status_code=500)

    # Handle image files
    img = cv2.imread(str(save_path))
    if img is not None:
        height, width = img.shape[:2]
    else:
        width, height = 1000, 1400

    result = ocr_engine(str(save_path))

    document_id = f"doc_{int(time.time())}_{file_id[:8]}"
    page = {
        "pageIndex": 0,
        "pageSize": {"width": width, "height": height},
        "dpi": 300,
        "rotation": 0,
        "elements": process_ocr_result(result, width, height)
    }
    data = {
        "documentId": document_id,
        "imageUrl": f"/output/{save_path.name}",  # Add imageUrl for images
        "pages": [page]
    }
    return JSONResponse(content={"success": True, "data": data})


@app.get("/")
def root():
    index_path = Path("web/index.html")
    if index_path.exists():
        with index_path.open("r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(html_content)
    else:
        return HTMLResponse("<h2>index.html not found</h2>", status_code=404)

if __name__ == "__main__":
    uvicorn.run("fastapi_app:app", host="0.0.0.0", port=8000, reload=True)
