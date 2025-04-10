"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Search } from "lucide-react";

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    department: string;
}

export default function DebouncedSearchExample() {
    // Sample data
    const users: User[] = [
        { id: 1, name: "John Smith", email: "john.smith@example.com", role: "Developer", department: "Engineering" },
        { id: 2, name: "Sarah Johnson", email: "sarah.j@example.com", role: "Designer", department: "Design" },
        { id: 3, name: "Michael Brown", email: "michael.b@example.com", role: "Product Manager", department: "Product" },
        { id: 4, name: "Emily Davis", email: "emily.d@example.com", role: "Developer", department: "Engineering" },
        { id: 5, name: "David Wilson", email: "david.w@example.com", role: "Marketing Specialist", department: "Marketing" },
        { id: 6, name: "Jessica Taylor", email: "jessica.t@example.com", role: "Designer", department: "Design" },
        { id: 7, name: "James Anderson", email: "james.a@example.com", role: "QA Engineer", department: "Engineering" },
        { id: 8, name: "Sophia Martinez", email: "sophia.m@example.com", role: "Sales Representative", department: "Sales" },
        { id: 9, name: "Daniel Thompson", email: "daniel.t@example.com", role: "Developer", department: "Engineering" },
        { id: 10, name: "Olivia Harris", email: "olivia.h@example.com", role: "HR Manager", department: "Human Resources" },
        { id: 11, name: "William Clark", email: "william.c@example.com", role: "Tech Lead", department: "Engineering" },
        { id: 12, name: "Emma Lewis", email: "emma.l@example.com", role: "Product Manager", department: "Product" },
        { id: 13, name: "Alexander Walker", email: "alex.w@example.com", role: "DevOps Engineer", department: "Engineering" },
        { id: 14, name: "Sophia Allen", email: "sophia.a@example.com", role: "UI Designer", department: "Design" },
        { id: 15, name: "Matthew Young", email: "matthew.y@example.com", role: "Frontend Developer", department: "Engineering" },
    ];

    // State for search input, filtered users, and loading state
    const [searchInput, setSearchInput] = useState<string>("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
    const [filteredUsers, setFilteredUsers] = useState<User[]>(users);
    const [isSearching, setIsSearching] = useState<boolean>(false);

    // Debounce function
    useEffect(() => {
        // Set searching state to true to show loading indicator
        if (searchInput) {
            setIsSearching(true);
        }

        // Create a timer to delay the search
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchInput);
        }, 500); // 500ms delay

        // Cleanup function to clear the timer on component unmount or when searchInput changes
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Memoized filter function
    const filterUsers = useCallback(() => {
        if (!debouncedSearchTerm.trim()) {
            setFilteredUsers(users);
            setIsSearching(false);
            return;
        }

        // Simulate an API call with a small delay
        setTimeout(() => {
            const term = debouncedSearchTerm.toLowerCase();
            const results = users.filter(
                user =>
                    user.name.toLowerCase().includes(term) ||
                    user.email.toLowerCase().includes(term) ||
                    user.role.toLowerCase().includes(term) ||
                    user.department.toLowerCase().includes(term)
            );

            setFilteredUsers(results);
            setIsSearching(false);
        }, 300); // Simulate network delay
    }, [debouncedSearchTerm, users]);

    // Apply the filter when debounced search term changes
    useEffect(() => {
        filterUsers();
    }, [debouncedSearchTerm, filterUsers]);

    // Handle search input change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <h1 className="text-2xl font-bold mb-6">User Directory Search</h1>

            {/* Search input with icon */}
            <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                    type="text"
                    placeholder="Search by name, email, role, or department..."
                    className="pl-10"
                    value={searchInput}
                    onChange={handleSearchChange}
                />
                {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                )}
            </div>

            {/* Filter stats */}
            <div className="text-sm text-gray-500 mb-4">
                {isSearching ? (
                    "Searching..."
                ) : (
                    `Found ${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''}`
                )}
            </div>

            {/* Results */}
            <div className="space-y-4">
                {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                        <Card key={user.id}>
                            <CardHeader className="py-3">
                                <CardTitle className="text-lg">{user.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="py-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div className="text-sm">
                                        <span className="text-gray-500">Email: </span>
                                        {user.email}
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-gray-500">Role: </span>
                                        {user.role}
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-gray-500">Department: </span>
                                        {user.department}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-500">No users match your search criteria</p>
                    </div>
                )}
            </div>

            {/* Performance notes */}
            <div className="mt-10 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h2 className="text-lg font-medium mb-2">Implementation Notes</h2>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                    <li>Uses a 500ms debounce to reduce redundant filtering while typing</li>
                    <li>Shows a loading indicator during the search process</li>
                    <li>Memoizes the filter function with useCallback for better performance</li>
                    <li>Simulates network delay that would occur in a real API-based search</li>
                    <li>Searches across multiple fields (name, email, role, department)</li>
                </ul>
            </div>
        </div>
    );
} 