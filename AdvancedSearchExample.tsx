"use client";

import React, { useState, useEffect } from "react";
import { Input } from "./components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";

interface Product {
    id: number;
    name: string;
    category: string;
    price: number;
    rating: number;
    inStock: boolean;
    tags: string[];
}

export default function AdvancedSearchExample() {
    // Sample product data
    const initialProducts: Product[] = [
        {
            id: 1,
            name: "iPhone 13",
            category: "Electronics",
            price: 799,
            rating: 4.5,
            inStock: true,
            tags: ["smartphone", "apple", "5G"]
        },
        {
            id: 2,
            name: "MacBook Pro",
            category: "Electronics",
            price: 1299,
            rating: 4.8,
            inStock: true,
            tags: ["laptop", "apple", "productivity"]
        },
        {
            id: 3,
            name: "Nike Air Max",
            category: "Fashion",
            price: 129,
            rating: 4.2,
            inStock: true,
            tags: ["shoes", "sportswear", "running"]
        },
        {
            id: 4,
            name: "Coffee Maker",
            category: "Home",
            price: 49,
            rating: 3.9,
            inStock: false,
            tags: ["kitchen", "appliance"]
        },
        {
            id: 5,
            name: "Yoga Mat",
            category: "Fitness",
            price: 25,
            rating: 4.0,
            inStock: true,
            tags: ["exercise", "wellness"]
        },
        {
            id: 6,
            name: "Running Shoes",
            category: "Fitness",
            price: 89,
            rating: 4.4,
            inStock: true,
            tags: ["shoes", "running", "sportswear"]
        },
        {
            id: 7,
            name: "Smart TV",
            category: "Electronics",
            price: 599,
            rating: 4.3,
            inStock: true,
            tags: ["television", "4K", "streaming"]
        },
        {
            id: 8,
            name: "Air Fryer",
            category: "Home",
            price: 79,
            rating: 4.7,
            inStock: false,
            tags: ["kitchen", "appliance", "cooking"]
        },
    ];

    // States
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>(initialProducts);

    // Filter states
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [categoryFilter, setCategoryFilter] = useState<string>("");
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 1500]);
    const [minRating, setMinRating] = useState<number>(0);
    const [stockFilter, setStockFilter] = useState<string>("all");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    // Get unique categories and tags
    const categories = [...new Set(products.map(product => product.category))];
    const allTags = [...new Set(products.flatMap(product => product.tags))];

    // Apply filters whenever any filter changes
    useEffect(() => {
        applyFilters();
    }, [searchQuery, categoryFilter, priceRange, minRating, stockFilter, selectedTags]);

    // Filter function
    const applyFilters = () => {
        let result = [...products];

        // Filter by search query (search in name and category)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(product =>
                product.name.toLowerCase().includes(query) ||
                product.category.toLowerCase().includes(query) ||
                product.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Filter by category
        if (categoryFilter) {
            result = result.filter(product => product.category === categoryFilter);
        }

        // Filter by price range
        result = result.filter(product =>
            product.price >= priceRange[0] && product.price <= priceRange[1]
        );

        // Filter by minimum rating
        if (minRating > 0) {
            result = result.filter(product => product.rating >= minRating);
        }

        // Filter by stock status
        if (stockFilter !== "all") {
            const inStockValue = stockFilter === "inStock";
            result = result.filter(product => product.inStock === inStockValue);
        }

        // Filter by selected tags
        if (selectedTags.length > 0) {
            result = result.filter(product =>
                selectedTags.some(tag => product.tags.includes(tag))
            );
        }

        setFilteredProducts(result);
    };

    // Handle reset filters
    const resetFilters = () => {
        setSearchQuery("");
        setCategoryFilter("");
        setPriceRange([0, 1500]);
        setMinRating(0);
        setStockFilter("all");
        setSelectedTags([]);
    };

    // Toggle tag selection
    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6">Advanced Search and Filter</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="md:col-span-1 bg-white p-4 rounded-lg shadow">
                    <h2 className="font-bold mb-4">Filters</h2>

                    {/* Search input */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Search</label>
                        <Input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Category filter */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Category</label>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All Categories</SelectItem>
                                {categories.map(category => (
                                    <SelectItem key={category} value={category}>{category}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Price range filter */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">
                            Price Range: ${priceRange[0]} - ${priceRange[1]}
                        </label>
                        <Slider
                            defaultValue={[0, 1500]}
                            min={0}
                            max={1500}
                            step={10}
                            value={priceRange}
                            onValueChange={setPriceRange}
                            className="my-4"
                        />
                    </div>

                    {/* Rating filter */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">
                            Minimum Rating: {minRating} stars
                        </label>
                        <Slider
                            defaultValue={[0]}
                            min={0}
                            max={5}
                            step={0.5}
                            value={[minRating]}
                            onValueChange={(value) => setMinRating(value[0])}
                            className="my-4"
                        />
                    </div>

                    {/* Stock filter */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Availability</label>
                        <Select value={stockFilter} onValueChange={setStockFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Products" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Products</SelectItem>
                                <SelectItem value="inStock">In Stock Only</SelectItem>
                                <SelectItem value="outOfStock">Out of Stock</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Tags filter */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Tags</label>
                        <div className="flex flex-wrap gap-2">
                            {allTags.map(tag => (
                                <Badge
                                    key={tag}
                                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() => toggleTag(tag)}
                                >
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Reset filters button */}
                    <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={resetFilters}
                    >
                        Reset Filters
                    </Button>
                </div>

                <div className="md:col-span-3">
                    {/* Results count */}
                    <div className="mb-4 text-sm text-gray-500">
                        Showing {filteredProducts.length} of {products.length} products
                    </div>

                    {/* Product grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map(product => (
                                <Card key={product.id}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between">
                                            <CardTitle className="text-lg">{product.name}</CardTitle>
                                            {product.inStock ? (
                                                <Badge variant="default" className="bg-green-500">In Stock</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-red-500">Out of Stock</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-500">{product.category}</span>
                                                <span className="font-bold">${product.price}</span>
                                            </div>
                                            <div className="text-sm">
                                                Rating: <span className="font-medium">{product.rating}/5</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {product.tags.map(tag => (
                                                    <Badge key={tag} variant="secondary" className="text-xs">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <div className="col-span-3 text-center py-12">
                                <p className="text-gray-500">No products match your filter criteria</p>
                                <Button variant="link" onClick={resetFilters}>
                                    Reset all filters
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 