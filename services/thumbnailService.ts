import * as ImageManipulator from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";

const THUMBNAIL_MAX_SIZE = 200;
const THUMBNAIL_QUALITY = 0.6;

class ThumbnailService {
  async generateImageThumbnail(uri: string): Promise<string | null> {
    if (Platform.OS === "web") return null;
    
    try {
      console.log("[ThumbnailService] Generating image thumbnail for:", uri.substring(0, 50));
      
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: THUMBNAIL_MAX_SIZE } }],
        { 
          compress: THUMBNAIL_QUALITY, 
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      
      console.log("[ThumbnailService] Image thumbnail generated:", result.uri.substring(0, 50));
      return result.uri;
    } catch (error) {
      console.warn("[ThumbnailService] Failed to generate image thumbnail:", error);
      return null;
    }
  }

  async generateVideoThumbnail(uri: string): Promise<string | null> {
    if (Platform.OS === "web") return null;
    
    try {
      console.log("[ThumbnailService] Generating video thumbnail for:", uri.substring(0, 50));
      
      const { uri: frameUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: 0,
      });
      
      const result = await ImageManipulator.manipulateAsync(
        frameUri,
        [{ resize: { width: THUMBNAIL_MAX_SIZE } }],
        { 
          compress: THUMBNAIL_QUALITY, 
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      
      console.log("[ThumbnailService] Video thumbnail generated:", result.uri.substring(0, 50));
      return result.uri;
    } catch (error) {
      console.warn("[ThumbnailService] Failed to generate video thumbnail:", error);
      return null;
    }
  }

  async generateThumbnail(uri: string, type: "image" | "video"): Promise<string | null> {
    if (type === "image") {
      return this.generateImageThumbnail(uri);
    } else if (type === "video") {
      return this.generateVideoThumbnail(uri);
    }
    return null;
  }
}

export const thumbnailService = new ThumbnailService();
