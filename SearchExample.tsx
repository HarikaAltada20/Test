"use client";

import React, { useState, useEffect } from "react";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

interface Item {
    id: number;
    name: string;
    category: string;
}

export default function SearchExample() {
    // Sample data for the example
    const initialItems: Item[] = [
        { id: 1, name: "iPhone 13", category: "Electronics" },
        { id: 2, name: "MacBook Pro", category: "Electronics" },
        { id: 3, name: "Nike Air Max", category: "Fashion" },
        { id: 4, name: "Coffee Maker", category: "Home" },
        { id: 5, name: "Yoga Mat", category: "Fitness" },
        { id: 6, name: "Running Shoes", category: "Fitness" },
        { id: 7, name: "Smart TV", category: "Electronics" },
        { id: 8, name: "Air Fryer", category: "Home" },
    ];

    // State for items and search term
    const [items, setItems] = useState<Item[]>(initialItems);
    const [filteredItems, setFilteredItems] = useState<Item[]>(initialItems);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [categoryFilter, setCategoryFilter] = useState<string>("");

    // Filter items whenever search term or category filter changes
    useEffect(() => {
        filterItems();
    }, [searchTerm, categoryFilter]);

    // Filter items based on search term and category
    const filterItems = () => {
        let result = [...items];

        // Filter by search term
        if (searchTerm) {
            result = result.filter(item =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by category
        if (categoryFilter) {
            result = result.filter(item =>
                item.category === categoryFilter
            );
        }

        setFilteredItems(result);
    };

    // Handle search input change
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    // Handle category selection
    const handleCategoryChange = (category: string) => {
        setCategoryFilter(category === categoryFilter ? "" : category);
    };

    // Get unique categories for filter buttons
    const categories = [...new Set(items.map(item => item.category))];

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6">Search and Filter Example</h1>

            {/* Search input */}
            <div className="mb-6">
                <Input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="max-w-md"
                />
            </div>

            {/* Category filter buttons */}
            <div className="flex gap-2 mb-6">
                {categories.map(category => (
                    <button
                        key={category}
                        onClick={() => handleCategoryChange(category)}
                        className={`px-3 py-1 rounded-md ${categoryFilter === category
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200 text-gray-800"
                            }`}
                    >
                        {category}
                    </button>
                ))}
                {categoryFilter && (
                    <button
                        onClick={() => setCategoryFilter("")}
                        className="px-3 py-1 rounded-md bg-gray-200 text-gray-800"
                    >
                        Clear Filter
                    </button>
                )}
            </div>

            {/* Display filtered items */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.length > 0 ? (
                    filteredItems.map(item => (
                        <Card key={item.id}>
                            <CardHeader>
                                <CardTitle>{item.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">{item.category}</p>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-3 text-center py-12">
                        <p className="text-gray-500">No items found matching your criteria</p>
                    </div>
                )}
            </div>

            {/* Display stats */}
            <div className="mt-6 text-sm text-gray-500">
                Showing {filteredItems.length} of {items.length} items
            </div>
        </div>
    );
} 