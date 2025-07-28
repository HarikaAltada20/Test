"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Download, Upload, Trash2, Send } from "lucide-react";

export function LoadingButtonExample() {
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsSaving(false);
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        // Simulate download
        await new Promise(resolve => setTimeout(resolve, 3000));
        setIsDownloading(false);
    };

    const handleUpload = async () => {
        setIsUploading(true);
        // Simulate upload
        await new Promise(resolve => setTimeout(resolve, 2500));
        setIsUploading(false);
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        // Simulate deletion
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsDeleting(false);
    };

    const handleSend = async () => {
        setIsSending(true);
        // Simulate sending
        await new Promise(resolve => setTimeout(resolve, 1800));
        setIsSending(false);
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-4 min-h-screen overflow-y-auto">
            <div className="space-y-6">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="text-xl sm:text-2xl">Button Loading States Examples</CardTitle>
                        <CardDescription className="text-sm sm:text-base">
                            Examples of how to use the enhanced Button component with loading states
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {/* Basic Save Button */}
                            <div className="space-y-2 min-w-0">
                                <h3 className="text-sm font-medium truncate">Basic Save</h3>
                                <Button
                                    onClick={handleSave}
                                    loading={isSaving}
                                    loadingText="Saving..."
                                    variant="default"
                                    className="w-full sm:w-auto"
                                >
                                    <Save className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">Save Changes</span>
                                </Button>
                            </div>

                            {/* Download Button */}
                            <div className="space-y-2 min-w-0">
                                <h3 className="text-sm font-medium truncate">Download</h3>
                                <Button
                                    onClick={handleDownload}
                                    loading={isDownloading}
                                    loadingText="Downloading..."
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                >
                                    <Download className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">Download File</span>
                                </Button>
                            </div>

                            {/* Upload Button */}
                            <div className="space-y-2 min-w-0">
                                <h3 className="text-sm font-medium truncate">Upload</h3>
                                <Button
                                    onClick={handleUpload}
                                    loading={isUploading}
                                    loadingText="Uploading..."
                                    variant="secondary"
                                    className="w-full sm:w-auto"
                                >
                                    <Upload className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">Upload File</span>
                                </Button>
                            </div>

                            {/* Delete Button */}
                            <div className="space-y-2 min-w-0">
                                <h3 className="text-sm font-medium truncate">Delete</h3>
                                <Button
                                    onClick={handleDelete}
                                    loading={isDeleting}
                                    loadingText="Deleting..."
                                    variant="destructive"
                                    className="w-full sm:w-auto"
                                >
                                    <Trash2 className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">Delete Item</span>
                                </Button>
                            </div>

                            {/* Send Button */}
                            <div className="space-y-2 min-w-0">
                                <h3 className="text-sm font-medium truncate">Send</h3>
                                <Button
                                    onClick={handleSend}
                                    loading={isSending}
                                    loadingText="Sending..."
                                    size="lg"
                                    className="w-full sm:w-auto"
                                >
                                    <Send className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">Send Message</span>
                                </Button>
                            </div>

                            {/* Disabled Button */}
                            <div className="space-y-2 min-w-0">
                                <h3 className="text-sm font-medium truncate">Disabled State</h3>
                                <Button
                                    disabled={true}
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                >
                                    <Save className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span className="truncate">Disabled Button</span>
                                </Button>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-muted rounded-lg">
                            <h3 className="text-sm font-medium mb-2">Key Features:</h3>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                                <li>• Automatic spinner when <code>loading={true}</code></li>
                                <li>• Custom loading text with <code>loadingText</code> prop</li>
                                <li>• Button automatically disabled during loading</li>
                                <li>• Works with all button variants and sizes</li>
                                <li>• Maintains existing functionality and props</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
} 