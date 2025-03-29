"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Camera, Upload, FileText, Trash2, Download, Loader2 } from "lucide-react"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import FileSaver from "file-saver"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function ImageToPdfConverter() {
  const [images, setImages] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("camera")
  const [cameraActive, setCameraActive] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState({
    camera: false,
    capture: false,
    pdf: false,
  })
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Cleanup function for camera stream
  const cleanupCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraActive(false)
    setIsLoading((prev) => ({ ...prev, camera: false }))
  }

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupCamera()

      // Revoke any object URLs to prevent memory leaks
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])

  // Start camera stream with better error handling
  const startCamera = async () => {
    setError(null)
    setIsLoading((prev) => ({ ...prev, camera: true }))

    try {
      // First try to get the environment-facing camera (back camera on mobile)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
          setCameraActive(true)
        }
      } catch (envError) {
        // If that fails, try with any available camera
        console.warn("Could not access environment camera, trying default:", envError)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
          setCameraActive(true)
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      setError("Could not access camera. Please check permissions or try the gallery option.")
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      })
    } finally {
      setIsLoading((prev) => ({ ...prev, camera: false }))
    }
  }

  // Stop camera stream with improved cleanup
  const stopCamera = () => {
    cleanupCamera()
  }

  // Capture image from camera with better error handling and loading state
  const captureImage = () => {
    setIsLoading((prev) => ({ ...prev, capture: true }))

    try {
      if (videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current
        const video = videoRef.current

        // Ensure video is playing and has dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          throw new Error("Video stream not ready yet")
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          throw new Error("Could not get canvas context")
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Optimize image quality/size - always use PNG for better compatibility
        const imageData = canvas.toDataURL("image/png", 0.85)
        setImages((prev) => [...prev, imageData])

        toast({
          title: "Image Captured",
          description: `Image ${images.length + 1} added to your collection.`,
        })
      }
    } catch (err) {
      console.error("Error capturing image:", err)
      toast({
        title: "Capture Failed",
        description: "Failed to capture image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading((prev) => ({ ...prev, capture: false }))
    }
  }

  // Handle file selection with better error handling
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setError(null)

    // Limit number of files to prevent performance issues
    const maxFiles = 10
    const filesToProcess = Array.from(files).slice(0, maxFiles)

    if (files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Only the first ${maxFiles} images will be processed to ensure performance.`,
      })
    }

    let loadedCount = 0
    const totalFiles = filesToProcess.length

    filesToProcess.forEach((file) => {
      // Check file size (limit to 5MB per file)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB and will be skipped.`,
          variant: "destructive",
        })
        loadedCount++
        return
      }

      const reader = new FileReader()

      reader.onload = (e) => {
        if (e.target && typeof e.target.result === "string") {
          // Resize large images to improve performance
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement("canvas")
            const MAX_WIDTH = 1800
            const MAX_HEIGHT = 1800
            let width = img.width
            let height = img.height

            // Resize if image is too large
            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
              if (width > height) {
                height = Math.round(height * (MAX_WIDTH / width))
                width = MAX_WIDTH
              } else {
                width = Math.round(width * (MAX_HEIGHT / height))
                height = MAX_HEIGHT
              }
            }

            canvas.width = width
            canvas.height = height

            const ctx = canvas.getContext("2d")
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height)
              // Always convert to PNG for better compatibility with pdf-lib
              const optimizedImage = canvas.toDataURL("image/png", 0.85)
              setImages((prev) => [...prev, optimizedImage])
            }

            loadedCount++
            if (loadedCount === totalFiles) {
              toast({
                title: "Images Loaded",
                description: `${loadedCount} images added successfully.`,
              })
            }
          }

          img.src = e.target.result
        }
      }

      reader.onerror = () => {
        console.error(`Error reading file: ${file.name}`)
        loadedCount++
        toast({
          title: "File Error",
          description: `Could not read ${file.name}.`,
          variant: "destructive",
        })
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
    toast({
      title: "Image Removed",
      description: "Image removed from collection.",
    })
  }

  // Generate PDF with improved error handling and performance
  const generatePDF = async () => {
    if (images.length === 0) {
      toast({
        title: "No Images",
        description: "Please add at least one image before generating a PDF.",
        variant: "destructive",
      })
      return
    }

    setIsLoading((prev) => ({ ...prev, pdf: true }))
    setError(null)

    // Revoke previous PDF URL to prevent memory leaks
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
      setPdfUrl(null)
    }

    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create()

      // Process images in batches to prevent UI freezing
      const batchSize = 3
      const totalBatches = Math.ceil(images.length / batchSize)

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize
        const batchEnd = Math.min((batchIndex + 1) * batchSize, images.length)
        const batch = images.slice(batchStart, batchEnd)

        // Process each image in the current batch
        for (const imageData of batch) {
          try {
            // Create a temporary image to get dimensions
            const img = document.createElement("img")
            img.src = imageData

            // Wait for image to load to get dimensions
            await new Promise((resolve) => {
              img.onload = resolve
            })

            // Create a canvas to draw the image
            const canvas = document.createElement("canvas")
            canvas.width = img.width
            canvas.height = img.height

            const ctx = canvas.getContext("2d")
            if (!ctx) continue

            // Draw the image on the canvas
            ctx.drawImage(img, 0, 0)

            // Get the image data as PNG (always use PNG for pdf-lib compatibility)
            const pngDataUrl = canvas.toDataURL("image/png")

            // Extract the base64 data
            const base64Data = pngDataUrl.split(",")[1]

            // Convert base64 to binary data
            const binaryData = atob(base64Data)
            const bytes = new Uint8Array(binaryData.length)
            for (let i = 0; i < binaryData.length; i++) {
              bytes[i] = binaryData.charCodeAt(i)
            }

            // Embed the PNG image
            const embeddedImage = await pdfDoc.embedPng(bytes)

            // Calculate dimensions while maintaining aspect ratio
            const MAX_WIDTH = 792 - 40 // US Letter width - margins
            const MAX_HEIGHT = 612 - 60 // US Letter height - margins

            let width = embeddedImage.width
            let height = embeddedImage.height

            if (width > MAX_WIDTH) {
              height = (height * MAX_WIDTH) / width
              width = MAX_WIDTH
            }

            if (height > MAX_HEIGHT) {
              width = (width * MAX_HEIGHT) / height
              height = MAX_HEIGHT
            }

            // Add a new page with appropriate dimensions
            const page = pdfDoc.addPage([width + 40, height + 60])

            // Draw the image
            page.drawImage(embeddedImage, {
              x: 20,
              y: 40,
              width,
              height,
            })

            // Add footer text
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
            page.drawText(" ", {
              x: 20,
              y: 20,
              size: 12,
              font,
              color: rgb(0.3, 0.3, 0.3),
            })
          } catch (imageError) {
            console.error("Error processing image for PDF:", imageError)
            // Continue with other images
          }
        }

        // Allow UI to update between batches
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      // Save the PDF
      const pdfBytes = await pdfDoc.save()

      // Convert to blob and create URL
      const blob = new Blob([pdfBytes], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)

      setPdfUrl(url)
      toast({
        title: "PDF Generated",
        description: "Your PDF has been created successfully.",
      })
    } catch (error) {
      console.error("Error generating PDF:", error)
      setError("Failed to generate PDF. Please try again with fewer or smaller images.")
      toast({
        title: "PDF Generation Failed",
        description: "Could not create PDF. Please try again with fewer images.",
        variant: "destructive",
      })
    } finally {
      setIsLoading((prev) => ({ ...prev, pdf: false }))
    }
  }

  // Download the generated PDF
  const downloadPDF = () => {
    if (pdfUrl) {
      FileSaver.saveAs(pdfUrl, "images-to-pdf.pdf")
      toast({
        title: "Download Started",
        description: "Your PDF is being downloaded.",
      })
    }
  }

  // Clean up on tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (value !== "camera" && cameraActive) {
      stopCamera()
    }
    setError(null)
  }

  // Clean up and reset
  const resetAll = () => {
    if (cameraActive) {
      stopCamera()
    }

    setImages([])

    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
      setPdfUrl(null)
    }

    setError(null)
    toast({
      title: "Reset Complete",
      description: "All images and PDF have been cleared.",
    })
  }

  return (
    <div className="container max-w-4xl mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Image to PDF Converter</CardTitle>
          <CardDescription>Capture images from your camera or select from your gallery to create a PDF</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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
                  <Button onClick={startCamera} disabled={isLoading.camera}>
                    {isLoading.camera ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Accessing Camera...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Start Camera
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button onClick={captureImage} variant="default" disabled={isLoading.capture}>
                      {isLoading.capture ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Capturing...
                        </>
                      ) : (
                        <>
                          <Camera className="mr-2 h-4 w-4" />
                          Capture
                        </>
                      )}
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
                  <p className="mt-2 text-sm text-muted-foreground">PNG, JPG or JPEG (max 5MB per file)</p>
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
                      loading="lazy" // Lazy load images for better performance
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
                <Button onClick={generatePDF} disabled={images.length === 0 || isLoading.pdf}>
                  {isLoading.pdf ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate PDF
                    </>
                  )}
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

