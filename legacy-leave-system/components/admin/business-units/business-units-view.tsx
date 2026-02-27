"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Building2, 
  Users, 
  Search, 
  Plus, 
  Eye,
  Calendar,
  Hash
} from "lucide-react";
import { CreateBusinessUnitDialog } from "../create-business-unit-dialog";

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    employees: number;
  };
}

interface BusinessUnitsViewProps {
  businessUnits: BusinessUnit[];
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
  businessUnitId: string;
}

// Helper function to get business unit initials
function getBusinessUnitInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function BusinessUnitsView({ businessUnits, currentUser, businessUnitId }: BusinessUnitsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});

  // Load business unit logos
  useEffect(() => {
    const loadLogos = async () => {
      const logoPromises = businessUnits
        .filter(unit => unit.image)
        .map(async (unit) => {
          try {
            const response = await fetch(`/api/business-unit-logo/${encodeURIComponent(unit.image!)}`);
            const result = await response.json();
            
            if (result.success && result.fileUrl) {
              return { id: unit.id, url: result.fileUrl };
            }
          } catch (error) {
            console.error(`Error loading logo for ${unit.name}:`, error);
          }
          return null;
        });

      const logoResults = await Promise.all(logoPromises);
      const logoMap: Record<string, string> = {};
      
      logoResults.forEach(result => {
        if (result) {
          logoMap[result.id] = result.url;
        }
      });
      
      setLogoUrls(logoMap);
    };

    if (businessUnits.length > 0) {
      loadLogos();
    }
  }, [businessUnits]);

  const filteredBusinessUnits = businessUnits.filter(unit =>
    unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Business Units</h1>
          <p className="text-sm text-muted-foreground">
            Manage business units and their configurations
          </p>
        </div>
        <CreateBusinessUnitDialog />
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search business units..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Business Units</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{businessUnits.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {businessUnits.reduce((sum, unit) => sum + unit._count.employees, 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {businessUnits.length > 0 
                ? Math.round(businessUnits.reduce((sum, unit) => sum + unit._count.employees, 0) / businessUnits.length)
                : 0
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business Units Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBusinessUnits.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No business units found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchTerm ? "No business units match your search criteria." : "Get started by creating your first business unit."}
                </p>
                {!searchTerm && (
                  <Button asChild>
                    <Link href={`/${businessUnitId}/admin/business-units/create`} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Business Unit
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredBusinessUnits.map((unit) => {
            const initials = getBusinessUnitInitials(unit.name);
            
            return (
              <Card key={unit.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className="h-16 w-16 border-2 border-border shadow-sm rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
                      {logoUrls[unit.id] ? (
                        <img 
                          src={logoUrls[unit.id]} 
                          alt={unit.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-lg font-semibold text-muted-foreground">
                          {initials}
                        </div>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-xl">{unit.name}</CardTitle>
                  <CardDescription className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Hash className="h-3 w-3" />
                        {unit.code}
                      </Badge>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Employees</span>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{unit._count.employees}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Created</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(unit.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button asChild className="w-full gap-2">
                      <Link href={`/${businessUnitId}/admin/business-units/${unit.id}`}>
                        <Eye className="h-4 w-4" />
                        View Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}