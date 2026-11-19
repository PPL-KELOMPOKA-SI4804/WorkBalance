<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Competency extends Model
{
    protected $table = 'competencies';

    protected $fillable = [
        'name',
        'category',
        'description',
    ];

    public function employeeCompetencies(): HasMany
    {
        return $this->hasMany(EmployeeCompetency::class, 'competency_id');
    }
}
