"use client";

import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  User, 
  Mail, 
  Building, 
  Calendar, 
  Edit, 
  Save, 
  X,
  Briefcase,
  Key
} from "lucide-react";
import { toast } from "sonner";
import { resetUserPassword, updateUserProfile } from "@/lib/actions/profile-actions";
import { ProfilePictureUpload } from "./profile-picture-upload";
import { AssignedAssetsSection } from "./assigned-assets-section";

interface ProfileViewProps {
  user: {
    id: string;
    name: string;
    email: string | null;
    employeeId: string;
    role: string;
    classification: string | null;
    profilePicture: string | null;
    businessUnit: {
      id: string;
      name: string;
      code: string;
    } | null;
    department: {
      id: string;
      name: string;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  };
  businessUnitId: string;
}

// Helper function to get user initials
function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Helper function to format role display
function formatRole(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';
    case 'HR':
      return 'Human Resources';
    case 'MANAGER':
      return 'Manager';
    case 'USER':
      return 'Employee';
    default:
      return role;
  }
}

// Helper function to get role color
function getRoleColor(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case 'ADMIN':
      return 'destructive';
    case 'HR':
      return 'default';
    case 'MANAGER':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function ProfileView({ user }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [, setProfileImageFileName] = useState<string | null>(user.profilePicture);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email || '',
    phone: '', // This would come from user data if available
    address: '', // This would come from user data if available
    bio: '', // This would come from user data if available
  });

  const userInitials = getUserInitials(user.name);

  // Load existing profile picture on mount
  useEffect(() => {
    const loadProfilePicture = async () => {
      if (user.profilePicture) {
        try {
          const url = `/api/profile-picture/${encodeURIComponent(user.profilePicture)}`;
          const response = await fetch(url);
          const result = await response.json();
          
          if (result.success && result.fileUrl) {
            setProfileImageUrl(result.fileUrl);
          }
        } catch (error) {
          console.error('Error loading profile picture:', error);
        }
      }
    };

    loadProfilePicture();
  }, [user.profilePicture, user.id]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await updateUserProfile(user.id, formData);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Profile updated successfully");
        setIsEditing(false);
      }
    } catch (error) {
      toast.error("Failed to update profile");
      console.error("Profile update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user.name,
      email: user.email || '',
      phone: '',
      address: '',
      bio: '',
    });
    setIsEditing(false);
  };

  const handleResetPassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setIsResettingPassword(true);
    try {
      const result = await resetUserPassword(user.id, passwordData.newPassword);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success || "Password reset successfully");
        setPasswordData({ newPassword: '', confirmPassword: '' });
        setIsPasswordDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to reset password");
      console.error("Password reset error:", error);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleProfilePictureUpload = (imageUrl: string, fileName: string) => {
    setProfileImageUrl(imageUrl);
    setProfileImageFileName(fileName);
  };

  const handleProfilePictureRemove = () => {
    setProfileImageUrl(null);
    setProfileImageFileName(null);
  };

  // Helper function to safely format date
  const formatDate = (date: Date) => {
    try {
      if (!date || isNaN(new Date(date).getTime())) {
        return 'Date not available';
      }
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Date not available';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account information and preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Profile
            </Button>
            
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleSave} 
                disabled={isLoading}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isLoading ? "Saving..." : "Save"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={isLoading}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}

                        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Key className="h-4 w-4" />
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                      Enter your new password below. Make sure it's at least 8 characters long.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setPasswordData({ newPassword: '', confirmPassword: '' });
                        setIsPasswordDialogOpen(false);
                      }}
                      disabled={isResettingPassword}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleResetPassword}
                      disabled={isResettingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    >
                      {isResettingPassword ? "Changing..." : "Change Password"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Section */}
        <div className="md:col-span-1 space-y-6">
          <div className="text-center space-y-4">
            {/* Profile Picture Section */}
            <ProfilePictureUpload
              currentImageUrl={profileImageUrl}
              userInitials={userInitials}
              userName={user.name}
              onUploadSuccess={handleProfilePictureUpload}
              onRemoveSuccess={handleProfilePictureRemove}
            />
            <div>
              <h2 className="text-xl font-semibold">{user.name}</h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge variant={getRoleColor(user.role)}>
                  {formatRole(user.role)}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{user.employeeId || 'No ID'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{user.email || 'No email'}</span>
            </div>
            
            {user.businessUnit && (
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{user.businessUnit.name}</span>
              </div>
            )}
            
            {user.department && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{user.department.name}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Joined {formatDate(user.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="md:col-span-2 space-y-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
              <User className="h-5 w-5" />
              Personal Information
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Update your personal details and contact information
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your full name"
                  />
                ) : (
                  <div className="px-3 py-2 bg-muted rounded-md text-sm">
                    {user.name}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email address"
                  />
                ) : (
                  <div className="px-3 py-2 bg-muted rounded-md text-sm">
                    {user.email || 'No email provided'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <div className="px-3 py-2 bg-muted rounded-md text-sm">
                    {formData.phone || 'No phone number provided'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                {isEditing ? (
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter your address"
                  />
                ) : (
                  <div className="px-3 py-2 bg-muted rounded-md text-sm">
                    {formData.address || 'No address provided'}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              {isEditing ? (
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  rows={4}
                />
              ) : (
                <div className="px-3 py-2 bg-muted rounded-md text-sm min-h-[100px]">
                  {formData.bio || 'No bio provided'}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Assigned Assets */}
        <AssignedAssetsSection userId={user.id} />
      </div>
    </div>
  );
}