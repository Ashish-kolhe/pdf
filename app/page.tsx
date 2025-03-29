"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Camera, Upload, FileText, Trash2, Download } from "lucide-react"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import FileSaver from "file-saver"

export default function ImageToPdfConverter() {
  const [images, setImages] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("camera")
  const [cameraActive, setCameraActive] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Start camera stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      alert("Could not access camera. Please check permissions.")
    }
  }

  // Stop camera stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setCameraActive(false)
    }
  }

  // Capture image from camera
  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = canvas.toDataURL("image/jpeg")
        setImages((prev) => [...prev, imageData])
      }
    }
  }

  // Handle file selection from gallery
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === "string") {
          setImages((prev) => [...prev, e.target.result])
        }
      }
      reader.readAsDataURL(file)
    })

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Remove image from list
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  // Generate PDF from images
  const generatePDF = async () => {
    if (images.length === 0) {
      alert("Please add at least one image")
      return
    }

    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create()

      // Add each image as a page
      for (const imageData of images) {
        // Remove data URL prefix to get base64 data
        const base64Data = imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, "")

        // Determine image type and embed it
        let imageBytes
        if (imageData.includes("data:image/png")) {
          imageBytes = await pdfDoc.embedPng(base64Data)
        } else {
          imageBytes = await pdfDoc.embedJpeg(base64Data)
        }

        // Add a new page with image dimensions
        const page = pdfDoc.addPage([imageBytes.width + 40, imageBytes.height + 60])

        // Draw the image
        page.drawImage(imageBytes, {
          x: 20,
          y: 40,
          width: imageBytes.width,
          height: imageBytes.height,
        })

        // Add footer text
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        page.drawText("Made by Ashish", {
          x: 20,
          y: 20,
          size: 12,
          font,
          color: rgb(0.3, 0.3, 0.3),
        })
      }

      // Save the PDF
      const pdfBytes = await pdfDoc.save()

      // Convert to blob and create URL
      const blob = new Blob([pdfBytes], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)

      setPdfUrl(url)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  // Download the generated PDF
  const downloadPDF = () => {
    if (pdfUrl) {
      FileSaver.saveAs(pdfUrl, "images-to-pdf.pdf")
    }
  }

  // Clean up on tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (value !== "camera" && cameraActive) {
      stopCamera()
    }
  }

  // Clean up on unmount
  const resetAll = () => {
    if (cameraActive) {
      stopCamera()
    }
    setImages([])
    setPdfUrl(null)
  }

  return (
    <div className="container max-w-4xl mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Image to PDF Converter</CardTitle>
          <CardDescription>Capture images from your camera or select from your gallery to create a PDF</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="camera" onClick={() => setActiveTab("camera")}>
                <Camera className="mr-2 h-4 w-4" />
                Camera
              </TabsTrigger>
              <TabsTrigger value="gallery" onClick={() => setActiveTab("gallery")}>
                <Upload className="mr-2 h-4 w-4" />
                Gallery
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="space-y-4">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                {cameraActive ? (
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Camera preview will appear here</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4">
                {!cameraActive ? (
                  <Button onClick={startCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    Start Camera
                  </Button>
                ) : (
                  <>
                    <Button onClick={captureImage} variant="default">
                      <Camera className="mr-2 h-4 w-4" />
                      Capture
                    </Button>
                    <Button onClick={stopCamera} variant="outline">
                      Stop Camera
                    </Button>
                  </>
                )}
              </div>

              {/* Hidden canvas for capturing images */}
              <canvas ref={canvasRef} className="hidden" />
            </TabsContent>

            <TabsContent value="gallery" className="space-y-4">
              <div className="flex justify-center p-8 border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div className="mt-4">
                    <Button onClick={() => fileInputRef.current?.click()}>Select Images</Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">PNG, JPG or JPEG</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Image preview section */}
          {images.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">Selected Images ({images.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image || "/placeholder.svg"}
                      alt={`Selected image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-md"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-center">
                <Button onClick={generatePDF} disabled={images.length === 0}>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate PDF
                </Button>
              </div>
            </div>
          )}

          {/* PDF preview section */}
          {pdfUrl && (
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">PDF Preview</h3>
              <div className="border rounded-lg overflow-hidden">
                <iframe src={pdfUrl} className="w-full h-[500px]" title="PDF Preview" />
              </div>

              <div className="mt-4 flex justify-center gap-4">
                <Button onClick={downloadPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={resetAll}>
                  Start Over
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
          <p className="text-sm text-muted-foreground">Made by Ashish</p>
        </CardFooter>
      </Card>
    </div>
  )
}

